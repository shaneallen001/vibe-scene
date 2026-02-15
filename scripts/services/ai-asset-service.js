import { GeminiService } from "./gemini-service.js";
import { PROMPTS } from "../ai/prompts.js";
import { AssetLibraryService } from "./asset-library-service.js";

export class AiAssetService {
    constructor(apiKey, model) {
        this.gemini = new GeminiService(apiKey, model);
        this.library = new AssetLibraryService();
    }

    /**
     * Generate an SVG asset based on a prompt
     * @param {string} prompt - The user's description
     * @param {string} [type="OBJECT"] - The archetype type (TEXTURE, OBJECT, STRUCTURE, WALL)
     * @returns {Promise<string>} - The cleaned SVG code
     */
    async generateSVG(prompt, type = "OBJECT") {
        const traceId = this._newTraceId("svg");
        const start = performance.now();
        console.log(`Vibe Scenes | [${traceId}] generateSVG:start`, {
            type,
            promptLength: String(prompt || "").length
        });
        const baseSystem = PROMPTS._BASE;
        const typeSystem = PROMPTS[`SVG_${type}`] || PROMPTS.SVG_OBJECT;

        const fullSystemPrompt = `${baseSystem}\n\n${typeSystem}`;

        try {
            // Call the generic service
            const rawText = await this.gemini.generateContent(prompt, fullSystemPrompt);
            console.log(`Vibe Scenes | [${traceId}] generateSVG:response-received`, {
                chars: rawText?.length || 0
            });

            // Clean up the output
            const cleaned = this._cleanMarkdown(rawText);
            const sanitized = this._sanitizeSVG(cleaned);
            console.log(`Vibe Scenes | [${traceId}] generateSVG:success`, {
                cleanedChars: cleaned?.length || 0,
                sanitizedChars: sanitized?.length || 0,
                elapsedMs: Math.round(performance.now() - start)
            });
            return sanitized;
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
            const rawText = await this.gemini.generateContent(prompt, system);
            const cleaned = this._cleanMarkdown(rawText);
            return JSON.parse(cleaned);
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
                hasDescription: Boolean(String(description || "").trim())
            });
            const rawText = await this.gemini.generateContent(prompt, system);
            console.log(`Vibe Scenes | [${traceId}] planDungeon:response-received`, {
                chars: rawText?.length || 0
            });
            const cleaned = this._cleanMarkdown(rawText);
            const result = JSON.parse(cleaned);

            // Handle legacy/fallback response format (array) just in case
            if (Array.isArray(result)) {
                console.warn(`Vibe Scenes | [${traceId}] planDungeon:legacy-array-response-fallback`, {
                    planRooms: result.length
                });
                return { plan: result, wishlist: [], default_floor: undefined };
            }

            console.log(`Vibe Scenes | [${traceId}] planDungeon:success`, {
                planRooms: result.plan?.length || 0,
                wishlist: result.wishlist?.length || 0,
                hasDefaultFloor: Boolean(result.default_floor),
                elapsedMs: Math.round(performance.now() - start)
            });
            return {
                plan: result.plan || [],
                wishlist: result.wishlist || [],
                default_floor: result.default_floor
            };

        } catch (error) {
            console.error(`Vibe Scenes | [${traceId}] planDungeon:failed`, error);
            console.warn(`Vibe Scenes | [${traceId}] planDungeon:fallback-empty-plan`, {
                elapsedMs: Math.round(performance.now() - start)
            });
            return { plan: [], wishlist: [], default_floor: undefined };
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

    /**
     * Helper to remove markdown code blocks from LLM output
     */
    _cleanMarkdown(text) {
        let cleaned = text.trim();
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

    /**
     * Sanitize SVG content to remove potential crash-inducing tags
     * @param {string} svgContent 
     */
    _sanitizeSVG(svgContent) {
        let content = svgContent;

        // 1. Remove XML Declaration
        content = content.replace(/<\?xml[^>]*\?>/gi, '');

        // 2. Remove <style> blocks
        content = content.replace(/<style>[\s\S]*?<\/style>/gi, '');

        // 3. Remove <defs> blocks if they are effectively empty or problematic?
        // Actually, keep defs for patterns, but maybe sanitize content? 
        // For now, let's keep <defs> as they are often used for patterns in textures.
        // The original code removed them, which might satisfy some constraint, but 
        // patterns NEED defs. The user previously removed them in step 22 (original code showed replace).
        // Wait, looking at line 214 of original file: `content = content.replace(/<defs>[\s\S]*?<\/defs>/gi, '');`
        // THIS MIGHT BE WHY TEXTURES FAILED! Textures use <pattern> inside <defs>.
        // If I remove <defs>, I remove the pattern definition, so the fill="url(#...)" will fail.
        // I should REMOVE this aggression against <defs>.

        // 4. Remove comments
        content = content.replace(/<!--[\s\S]*?-->/g, '');

        // 5. Trim whitespace
        content = content.trim();

        // 6. Ensure xmlns
        if (!content.includes('xmlns="http://www.w3.org/2000/svg"')) {
            content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        // 7. Ensure Width and Height
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
