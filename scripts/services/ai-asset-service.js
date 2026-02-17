import { GeminiService } from "./gemini-service.js";
import { PROMPTS } from "../ai/prompts.js";
import { AssetLibraryService } from "./asset-library-service.js";

export class AiAssetService {
    constructor(apiKey, modelConfig) {
        const models = this._resolveModels(modelConfig);
        this.textModel = models.text;
        this.svgModel = models.svg;
        this.gemini = new GeminiService(apiKey, this.textModel);
        this.library = new AssetLibraryService();
    }

    /**
     * Generate an SVG asset based on a prompt
     * @param {string} prompt - The user's description
     * @param {string} [type="OBJECT"] - The archetype type (TEXTURE, OBJECT, STRUCTURE, WALL)
     * @returns {Promise<string>} - The cleaned SVG code
     */
    async generateSVG(prompt, type = "OBJECT", options = {}) {
        const traceId = this._newTraceId("svg");
        const start = performance.now();
        const normalizedType = String(type || "OBJECT").toUpperCase();
        const svgOptions = this._normalizeSVGOptions(normalizedType, options);
        const basePrompt = String(prompt || "").trim();
        console.log(`Vibe Scenes | [${traceId}] generateSVG:start`, {
            type: normalizedType,
            promptLength: basePrompt.length,
            svgModel: this.svgModel,
            maxPasses: svgOptions.maxPasses,
            minScore: svgOptions.minScore
        });
        const baseSystem = PROMPTS._BASE;
        const typeSystem = PROMPTS[`SVG_${normalizedType}`] || PROMPTS.SVG_OBJECT;
        const fullSystemPrompt = `${baseSystem}\n\n${typeSystem}`;

        let bestCandidate = null;
        let revisionPrompt = "";

        try {
            for (let pass = 1; pass <= svgOptions.maxPasses; pass++) {
                const generationPrompt = this._buildGenerationPrompt(basePrompt, revisionPrompt, pass, svgOptions.maxPasses);
                const rawText = await this.gemini.generateContent(generationPrompt, fullSystemPrompt, {
                    model: this.svgModel,
                    temperature: pass === 1 ? svgOptions.initialTemperature : svgOptions.refineTemperature,
                    maxOutputTokens: svgOptions.maxOutputTokens
                });
                console.log(`Vibe Scenes | [${traceId}] generateSVG:response-received`, {
                    pass,
                    chars: rawText?.length || 0
                });

                const cleaned = this._cleanMarkdown(rawText);
                const sanitized = this._sanitizeSVG(cleaned);
                const structural = this._validateSVGStructure(sanitized, normalizedType);
                const critique = await this._critiqueSVG({
                    svgContent: sanitized,
                    originalPrompt: basePrompt,
                    type: normalizedType,
                    traceId,
                    pass
                });
                const score = this._scoreSVG(structural, critique);
                const issues = [
                    ...structural.issues,
                    ...(Array.isArray(critique.must_fix) ? critique.must_fix : [])
                ];
                const candidate = {
                    svg: sanitized,
                    score,
                    pass,
                    issues,
                    improvements: Array.isArray(critique.improvements) ? critique.improvements : [],
                    revisionPrompt: critique.revision_prompt || ""
                };
                if (!bestCandidate || candidate.score > bestCandidate.score) {
                    bestCandidate = candidate;
                }

                const accepted = structural.ok && score >= svgOptions.minScore;
                console.log(`Vibe Scenes | [${traceId}] generateSVG:pass-evaluated`, {
                    pass,
                    structuralOk: structural.ok,
                    score,
                    minScore: svgOptions.minScore,
                    accepted,
                    issueCount: issues.length
                });

                if (accepted) {
                    console.log(`Vibe Scenes | [${traceId}] generateSVG:success`, {
                        pass,
                        score,
                        sanitizedChars: sanitized?.length || 0,
                        elapsedMs: Math.round(performance.now() - start)
                    });
                    return sanitized;
                }

                revisionPrompt = this._buildRevisionPrompt(candidate);
            }

            if (bestCandidate?.svg) {
                console.warn(`Vibe Scenes | [${traceId}] generateSVG:best-effort-return`, {
                    bestScore: bestCandidate.score,
                    bestPass: bestCandidate.pass,
                    elapsedMs: Math.round(performance.now() - start)
                });
                return bestCandidate.svg;
            }
            throw new Error("SVG generation returned no usable candidate.");
        } catch (error) {
            console.error(`Vibe Scenes | [${traceId}] generateSVG:failed`, error);
            throw error;
        }
    }

    /**
     * Ask AI to suggest contents for a room
     * @param {Object} roomData - { type, width, height }
     * @param {Array} availableAssets - List of asset names/IDs
     * @returns {Promise<Array>} - List of items { name, x, y, rotation }
     */
    async suggestRoomContents(roomData, availableAssets = []) {
        const type = roomData.type || "Generic Dungeon Room";

        let prompt = `Room Type: ${type}\nWidth: ${roomData.width}\nHeight: ${roomData.height}`;
        if (availableAssets.length > 0) {
            prompt += `\nAVAILABLE_ASSETS: ${JSON.stringify(availableAssets)}`;
        }

        const system = PROMPTS.ROOM_CONTENT;

        try {
            const rawText = await this.gemini.generateContent(prompt, system, {
                model: this.textModel,
                temperature: 0.25,
                responseMimeType: "application/json"
            });
            const parsed = this._parseJSON(rawText);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Vibe Scenes | Failed to suggest room contents:", error);
            return [];
        }
    }

    /**
     * Plan the layout and contents of an entire dungeon
     * @param {Array} rooms - List of room objects with connections
     * @param {Array} availableAssets - List of available asset IDs
     * @returns {Promise<Object>} - { plan: Array, wishlist: Array }
     */
    async planDungeon(rooms, availableAssets = [], description = "") {
        const traceId = this._newTraceId("plan");
        const start = performance.now();
        // Strip unnecessary data from rooms to save tokens
        const minimalRooms = rooms.map(r => ({
            id: r.id,
            width: r.width,
            height: r.height,
            area: r.width * r.height,
            connections: r.connections
        }));

        const prompt = `DESCRIPTION: ${description || "A generic fantasy dungeon."}\n\nROOMS: ${JSON.stringify(minimalRooms)}\n\nAVAILABLE_ASSETS: ${JSON.stringify(availableAssets)}`;
        const system = PROMPTS.DUNGEON_PLANNER;

        try {
            console.log(`Vibe Scenes | [${traceId}] planDungeon:start`, {
                rooms: minimalRooms.length,
                availableAssets: availableAssets.length,
                hasDescription: Boolean(String(description || "").trim()),
                textModel: this.textModel
            });
            const rawText = await this.gemini.generateContent(prompt, system, {
                model: this.textModel,
                temperature: 0.25,
                responseMimeType: "application/json"
            });
            console.log(`Vibe Scenes | [${traceId}] planDungeon:response-received`, {
                chars: rawText?.length || 0
            });
            const result = this._parseJSON(rawText);

            // Handle legacy/fallback response format (array) just in case
            if (Array.isArray(result)) {
                console.warn(`Vibe Scenes | [${traceId}] planDungeon:legacy-array-response-fallback`, {
                    planRooms: result.length
                });
                return { plan: result, wishlist: [], default_floor: undefined, default_wall: undefined };
            }
            if (!result || typeof result !== "object") {
                throw new Error("Planner response was not a JSON object.");
            }

            console.log(`Vibe Scenes | [${traceId}] planDungeon:success`, {
                planRooms: result.plan?.length || 0,
                wishlist: result.wishlist?.length || 0,
                hasDefaultFloor: Boolean(result.default_floor),
                hasDefaultWall: Boolean(result.default_wall),
                elapsedMs: Math.round(performance.now() - start)
            });
            return {
                plan: result.plan || [],
                wishlist: result.wishlist || [],
                default_floor: result.default_floor,
                default_wall: result.default_wall
            };

        } catch (error) {
            console.error(`Vibe Scenes | [${traceId}] planDungeon:failed`, error);
            console.warn(`Vibe Scenes | [${traceId}] planDungeon:fallback-empty-plan`, {
                elapsedMs: Math.round(performance.now() - start)
            });
            return { plan: [], wishlist: [], default_floor: undefined, default_wall: undefined };
        }
    }

    /**
     * Plan an intentional dungeon outline (macro shape + rooms + room flavor).
     * @param {Object} input
     * @param {number} input.width
     * @param {number} input.height
     * @param {number} input.targetRoomCount
     * @param {string} input.shapePreference
     * @param {string} input.description
     * @returns {Promise<Object>} - { mask_type, default_floor, rooms, connections }
     */
    async planDungeonOutline(input = {}) {
        const traceId = this._newTraceId("outline");
        const start = performance.now();
        const payload = {
            description: String(input.description || "").trim() || "A generic fantasy dungeon.",
            bounds: {
                width: Number(input.width) || 90,
                height: Number(input.height) || 90
            },
            target_room_count: Math.max(3, Number(input.targetRoomCount) || 20),
            shape_preference: String(input.shapePreference || "rectangle")
        };

        try {
            console.log(`Vibe Scenes | [${traceId}] planDungeonOutline:start`, {
                width: payload.bounds.width,
                height: payload.bounds.height,
                targetRoomCount: payload.target_room_count,
                shapePreference: payload.shape_preference,
                hasDescription: Boolean(payload.description)
            });
            const rawText = await this.gemini.generateContent(
                `DESCRIPTION: ${payload.description}\n\nBOUNDS: ${JSON.stringify(payload.bounds)}\n\nTARGET_ROOM_COUNT: ${payload.target_room_count}\n\nSHAPE_PREFERENCE: ${payload.shape_preference}`,
                PROMPTS.DUNGEON_OUTLINE_PLANNER,
                {
                    model: this.textModel,
                    temperature: 0.35,
                    responseMimeType: "application/json"
                }
            );
            const parsed = this._parseJSON(rawText);
            const rooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
            const connections = Array.isArray(parsed?.connections) ? parsed.connections : [];
            console.log(`Vibe Scenes | [${traceId}] planDungeonOutline:success`, {
                rooms: rooms.length,
                connections: connections.length,
                maskType: parsed?.mask_type || payload.shape_preference,
                elapsedMs: Math.round(performance.now() - start)
            });
            return {
                mask_type: parsed?.mask_type || payload.shape_preference || "rectangle",
                default_floor: parsed?.default_floor,
                default_wall: parsed?.default_wall,
                rooms,
                connections
            };
        } catch (error) {
            console.error(`Vibe Scenes | [${traceId}] planDungeonOutline:failed`, error);
            return {
                mask_type: payload.shape_preference || "rectangle",
                default_floor: undefined,
                default_wall: undefined,
                rooms: [],
                connections: []
            };
        }
    }

    /**
     * Generate detailed room contents/wishlist from an intentional outline.
     * @param {Object} input
     * @param {Array} input.rooms
     * @param {Array} input.connections
     * @param {string} input.maskType
     * @param {string} input.defaultFloor
     * @param {string} input.description
     * @param {Array} availableAssets
     * @returns {Promise<Object>} - { plan, wishlist, default_floor }
     */
    async planDungeonFromOutline(input = {}, availableAssets = []) {
        const traceId = this._newTraceId("outline-content");
        const start = performance.now();
        const rooms = Array.isArray(input.rooms) ? input.rooms : [];
        const minimalRooms = rooms.map(r => ({
            id: r.id,
            width: r.width,
            height: r.height,
            area: (r.width || 0) * (r.height || 0),
            theme: r.theme || "",
            description: r.description || "",
            connections: Array.isArray(r.connections) ? r.connections : []
        }));
        const outline = {
            mask_type: input.maskType || "rectangle",
            default_floor: input.defaultFloor || "",
            rooms: minimalRooms,
            connections: Array.isArray(input.connections) ? input.connections : []
        };
        const prompt = `DESCRIPTION: ${input.description || "A generic fantasy dungeon."}\n\nOUTLINE: ${JSON.stringify(outline)}\n\nAVAILABLE_ASSETS: ${JSON.stringify(availableAssets)}`;

        try {
            console.log(`Vibe Scenes | [${traceId}] planDungeonFromOutline:start`, {
                rooms: minimalRooms.length,
                connections: outline.connections.length,
                availableAssets: availableAssets.length
            });
            const rawText = await this.gemini.generateContent(prompt, PROMPTS.DUNGEON_CONTENT_PLANNER, {
                model: this.textModel,
                temperature: 0.25,
                responseMimeType: "application/json"
            });
            const result = this._parseJSON(rawText);
            if (!result || typeof result !== "object") {
                throw new Error("Outline content planner response was not a JSON object.");
            }
            console.log(`Vibe Scenes | [${traceId}] planDungeonFromOutline:success`, {
                planRooms: result.plan?.length || 0,
                wishlist: result.wishlist?.length || 0,
                hasDefaultFloor: Boolean(result.default_floor),
                hasDefaultWall: Boolean(result.default_wall),
                elapsedMs: Math.round(performance.now() - start)
            });
            return {
                plan: result.plan || [],
                wishlist: result.wishlist || [],
                default_floor: result.default_floor,
                default_wall: result.default_wall
            };
        } catch (error) {
            console.error(`Vibe Scenes | [${traceId}] planDungeonFromOutline:failed`, error);
            return { plan: [], wishlist: [], default_floor: input.defaultFloor, default_wall: undefined };
        }
    }

    /**
     * Save a generated asset to the library
     * @param {string} svgContent 
     * @param {string} baseName 
     * @param {string} type 
     * @param {Object} tags - tags to infer style
     * @param {Object} metadata - { prompt, model }
     */
    async saveAsset(svgContent, baseName, type, tags = [], metadata = {}) {
        const traceId = this._newTraceId("save");
        const start = performance.now();
        // This method assumes Browser Environment (Foundry)
        const FP = foundry.applications?.apps?.FilePicker?.implementation;
        if (!FP) {
            console.warn(`Vibe Scenes | [${traceId}] saveAsset:FilePicker-unavailable-skip`);
            return;
        }

        const fileName = `${baseName}.svg`;
        // types mapping: TEXTURE -> texture, OBJECT -> object
        const folderType = type.toLowerCase();
        const path = `modules/vibe-scenes/assets/${folderType}`;
        const filePath = `${path}/${fileName}`;

        // Create File
        const file = new File([svgContent], fileName, { type: "image/svg+xml" });

        // Upload
        try {
            console.log(`Vibe Scenes | [${traceId}] saveAsset:upload-start`, {
                filePath,
                svgChars: svgContent?.length || 0,
                tagsCount: tags?.length || 0
            });
            await FP.upload("data", path, file, {}, { notify: false });
            console.log(`Vibe Scenes | [${traceId}] saveAsset:upload-success`);

            // VERIFY: Ensure file is actually accessible before proceeding
            const verified = await this._verifyAssetAccess(filePath, 5, traceId);
            if (!verified) {
                console.warn(`Vibe Scenes | [${traceId}] saveAsset:verify-failed-fallback-registering-anyway`, { filePath });
            } else {
                console.log(`Vibe Scenes | [${traceId}] saveAsset:verified`, { filePath });
            }

            // Register in Library
            console.log(`Vibe Scenes | [${traceId}] saveAsset:library-register-start`);
            await this.library.registerAsset({
                name: baseName, // Use filename as name
                prompt: metadata.prompt,
                model: metadata.model,
                path: filePath,
                fileType: "svg",
                source: "ai-gen",
                tags: ["ai-gen", ...tags],
                type: type,
                width: 1,
                height: 1
            });
            console.log(`Vibe Scenes | [${traceId}] saveAsset:library-register-success`, {
                filePath,
                elapsedMs: Math.round(performance.now() - start)
            });

            return filePath;
        } catch (e) {
            console.error(`Vibe Scenes | [${traceId}] saveAsset:failed`, e);
            throw e;
        }
    }

    /**
     * Verify that an asset is accessible via HTTP
     * @param {string} path 
     * @param {number} retries 
     */
    async _verifyAssetAccess(path, retries = 5, traceId = "verify-unknown") {
        for (let i = 0; i < retries; i++) {
            try {
                // Add timestamp to bust cache
                const url = `${path}?t=${Date.now()}`;
                const res = await fetch(url, { method: "HEAD" });
                if (res.ok) {
                    console.log(`Vibe Scenes | [${traceId}] verifyAssetAccess:ok`, { attempt: i + 1, retries, path });
                    return true;
                }
                console.warn(`Vibe Scenes | [${traceId}] verifyAssetAccess:not-ok`, { attempt: i + 1, retries, status: res.status, path });
            } catch (e) {
                console.warn(`Vibe Scenes | [${traceId}] verifyAssetAccess:error`, { attempt: i + 1, retries, message: e?.message || String(e) });
            }
            // Wait 500ms
            await this._wait(500);
        }
        console.warn(`Vibe Scenes | [${traceId}] verifyAssetAccess:exhausted-retries`, { retries, path });
        return false;
    }

    _newTraceId(prefix) {
        return `vs-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _resolveModels(modelConfig) {
        const fallbackText = "gemini-3-flash-preview";
        const fallbackSvg = "gemini-3-pro-preview";
        if (typeof modelConfig === "string" && modelConfig.trim()) {
            return { text: modelConfig.trim(), svg: modelConfig.trim() };
        }
        if (modelConfig && typeof modelConfig === "object") {
            const text = String(modelConfig.text || modelConfig.default || fallbackText).trim();
            const svg = String(modelConfig.svg || modelConfig.default || fallbackSvg || text).trim();
            return {
                text: text || fallbackText,
                svg: svg || fallbackSvg || text || fallbackText
            };
        }
        return { text: fallbackText, svg: fallbackSvg };
    }

    _normalizeSVGOptions(type, options = {}) {
        const maxPasses = Number.isFinite(options.maxPasses) ? Math.max(1, Math.min(5, options.maxPasses)) : 3;
        const minScore = Number.isFinite(options.minScore) ? this._clamp(options.minScore, 0, 100) : this._defaultMinimumScore(type);
        const maxOutputTokens = Number.isFinite(options.maxOutputTokens) ? Math.max(512, options.maxOutputTokens) : 8192;
        return {
            maxPasses,
            minScore,
            maxOutputTokens,
            initialTemperature: Number.isFinite(options.initialTemperature) ? options.initialTemperature : 0.85,
            refineTemperature: Number.isFinite(options.refineTemperature) ? options.refineTemperature : 0.55
        };
    }

    _defaultMinimumScore(type) {
        const normalized = String(type || "").toUpperCase();
        if (normalized === "TEXTURE" || normalized === "WALL") return 82;
        if (normalized === "STRUCTURE") return 80;
        return 78;
    }

    _buildGenerationPrompt(basePrompt, revisionPrompt, pass, maxPasses) {
        let output = String(basePrompt || "").trim();
        output += `\n\nQUALITY TARGET: premium-quality, highly detailed, game-ready top-down SVG.`;
        output += `\nPASS: ${pass}/${maxPasses}.`;
        if (revisionPrompt) {
            output += `\n\nREVISION GOALS:\n${revisionPrompt}`;
        }
        return output;
    }

    _validateSVGStructure(svgContent, type) {
        const issues = [];
        const content = String(svgContent || "").trim();
        if (!content.startsWith("<svg")) {
            issues.push("Output does not start with <svg.");
        }
        if (!/viewBox\s*=\s*["']0\s+0\s+512\s+512["']/i.test(content)) {
            issues.push("Missing canonical viewBox 0 0 512 512.");
        }
        if (!/<(path|rect|circle|ellipse|polygon|polyline|line|g)\b/i.test(content)) {
            issues.push("No visible SVG geometry elements detected.");
        }

        const normalizedType = String(type || "").toUpperCase();
        if ((normalizedType === "TEXTURE" || normalizedType === "WALL") && !/width\s*=\s*["']512["']/i.test(content)) {
            issues.push("Texture should explicitly render at full 512 width.");
        }
        if ((normalizedType === "TEXTURE" || normalizedType === "WALL") && !/height\s*=\s*["']512["']/i.test(content)) {
            issues.push("Texture should explicitly render at full 512 height.");
        }
        return { ok: issues.length === 0, issues };
    }

    async _critiqueSVG({ svgContent, originalPrompt, type, traceId, pass }) {
        const payload = JSON.stringify({
            type,
            originalPrompt,
            svg: svgContent
        });
        try {
            const rawText = await this.gemini.generateContent(payload, PROMPTS.SVG_CRITIC, {
                model: this.textModel,
                temperature: 0.1,
                maxOutputTokens: 1200,
                responseMimeType: "application/json"
            });
            const parsed = this._parseJSON(rawText);
            const score = this._clamp(Number(parsed?.score ?? 0), 0, 100);
            return {
                score,
                must_fix: Array.isArray(parsed?.must_fix) ? parsed.must_fix : [],
                improvements: Array.isArray(parsed?.improvements) ? parsed.improvements : [],
                revision_prompt: typeof parsed?.revision_prompt === "string" ? parsed.revision_prompt : ""
            };
        } catch (error) {
            console.warn(`Vibe Scenes | [${traceId}] generateSVG:critique-failed`, {
                pass,
                message: error?.message || String(error)
            });
            return {
                score: 0,
                must_fix: [],
                improvements: [],
                revision_prompt: ""
            };
        }
    }

    _scoreSVG(structural, critique) {
        let score = 100;
        score -= structural.issues.length * 20;
        const critiqueScore = Number(critique?.score);
        if (Number.isFinite(critiqueScore) && critiqueScore > 0) {
            score = Math.min(score, critiqueScore);
        } else if (Array.isArray(critique?.must_fix) && critique.must_fix.length) {
            score -= critique.must_fix.length * 8;
        }
        return this._clamp(Math.round(score), 0, 100);
    }

    _buildRevisionPrompt(candidate) {
        const mustFix = Array.isArray(candidate?.issues) ? candidate.issues : [];
        const improvements = Array.isArray(candidate?.improvements) ? candidate.improvements : [];
        const revisionParts = [];
        if (mustFix.length) {
            revisionParts.push("Must fix: " + mustFix.slice(0, 6).join("; "));
        }
        if (improvements.length) {
            revisionParts.push("Improve: " + improvements.slice(0, 6).join("; "));
        }
        if (candidate?.revisionPrompt) {
            revisionParts.push(candidate.revisionPrompt);
        }
        return revisionParts.filter(Boolean).join("\n");
    }

    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Helper to remove markdown code blocks from LLM output
     */
    _cleanMarkdown(text) {
        let cleaned = String(text || "").trim();
        if (cleaned.startsWith("```")) {
            const lines = cleaned.split("\n");
            // Remove first line (e.g. ```xml or ```svg)
            lines.shift();
            // Remove last line if it is just backticks
            if (lines[lines.length - 1].trim().startsWith("```")) {
                lines.pop();
            }
            cleaned = lines.join("\n").trim();
        }
        return cleaned;
    }

    _parseJSON(text) {
        const cleaned = this._cleanMarkdown(text);
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            const objectMatch = cleaned.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                try {
                    return JSON.parse(objectMatch[0]);
                } catch (_) {
                    // Continue to next fallback.
                }
            }
            const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                try {
                    return JSON.parse(arrayMatch[0]);
                } catch (_) {
                    // Continue to throw the original parse error.
                }
            }
            throw error;
        }
    }

    /**
     * Sanitize SVG content to remove potential crash-inducing tags
     * @param {string} svgContent 
     */
    _sanitizeSVG(svgContent) {
        let content = String(svgContent || "");

        // 1. Remove XML Declaration
        content = content.replace(/<\?xml[^>]*\?>/gi, '');

        // 2. Remove <style> blocks
        content = content.replace(/<style>[\s\S]*?<\/style>/gi, '');

        // 3. Remove comments
        content = content.replace(/<!--[\s\S]*?-->/g, '');

        // 4. Trim whitespace
        content = content.trim();

        // 5. Ensure xmlns
        if (!content.includes('xmlns="http://www.w3.org/2000/svg"')) {
            content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        // 6. Ensure Width and Height
        // Regex to find the opening <svg ... > tag
        const svgOpenTagMatch = content.match(/<svg([^>]*)>/);

        if (svgOpenTagMatch) {
            let attributes = svgOpenTagMatch[1];
            let newAttributes = attributes;

            // Check if width exists IN THE OPEN TAG
            if (!/width\s*=\s*["']/.test(attributes)) {
                newAttributes += ' width="512"';
            }
            // Check if height exists IN THE OPEN TAG
            if (!/height\s*=\s*["']/.test(attributes)) {
                newAttributes += ' height="512"';
            }

            if (newAttributes !== attributes) {
                content = content.replace(svgOpenTagMatch[0], `<svg${newAttributes}>`);
            }
        } else {
            // Fallback if no svg tag found (weird)
            console.warn("Vibe Scenes | Could not find <svg> tag for sanitization");
        }

        return content;
    }
}
