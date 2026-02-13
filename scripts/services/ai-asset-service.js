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
        const baseSystem = PROMPTS._BASE;
        const typeSystem = PROMPTS[`SVG_${type}`] || PROMPTS.SVG_OBJECT;

        const fullSystemPrompt = `${baseSystem}\n\n${typeSystem}`;

        // Call the generic service
        const rawText = await this.gemini.generateContent(prompt, fullSystemPrompt);

        // Clean up the output
        const cleaned = this._cleanMarkdown(rawText);
        return this._sanitizeSVG(cleaned);
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
    async planDungeon(rooms, availableAssets = []) {
        // Strip unnecessary data from rooms to save tokens
        const minimalRooms = rooms.map(r => ({
            id: r.id,
            width: r.width,
            height: r.height,
            connections: r.connections
        }));

        const prompt = `ROOMS: ${JSON.stringify(minimalRooms)}\n\nAVAILABLE_ASSETS: ${JSON.stringify(availableAssets)}`;
        const system = PROMPTS.DUNGEON_PLANNER;

        try {
            console.log("Vibe Scenes | Sending dungeon plan request to AI with dynamic wishlist...");
            const rawText = await this.gemini.generateContent(prompt, system);
            const cleaned = this._cleanMarkdown(rawText);
            const result = JSON.parse(cleaned);

            // Handle legacy/fallback response format (array) just in case
            if (Array.isArray(result)) {
                return { plan: result, wishlist: [] };
            }

            return {
                plan: result.plan || [],
                wishlist: result.wishlist || []
            };

        } catch (error) {
            console.error("Vibe Scenes | Failed to plan dungeon:", error);
            return { plan: [], wishlist: [] };
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
        // This method assumes Browser Environment (Foundry)
        if (typeof FilePicker === "undefined") {
            console.warn("Vibe Scenes | FilePicker not available (Node.js?). Skipping save to library.");
            return;
        }

        const fileName = `${baseName}.svg`;
        // types mapping: TEXTURE -> texture, OBJECT -> object
        const folderType = type.toLowerCase();
        const path = `modules/vibe-scenes/assets/${folderType}`;
        // Ensure path exists (optional, FilePicker usually handles this or throws)
        // const filePath = `${path}/${fileName}`; 

        // Use FilePicker to upload
        // Note: FilePicker.upload returns the result, which might contain the actual path?
        // Usually we construct the path manually for Foundry.
        const filePath = `${path}/${fileName}`;

        // Create File
        const file = new File([svgContent], fileName, { type: "image/svg+xml" });

        // Upload
        try {
            await FilePicker.upload("data", path, file, {}, { notify: false });

            // VERIFY: Ensure file is actually accessible before proceeding
            const verified = await this._verifyAssetAccess(filePath);
            if (!verified) {
                console.warn(`Vibe Scenes | Asset saved but not immediately accessible: ${filePath}`);
            } else {
                console.log(`Vibe Scenes | Saved and verified asset at ${filePath}`);
            }

            // Register in Library
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

            return filePath;
        } catch (e) {
            console.error("Vibe Scenes | Failed to save asset:", e);
            throw e;
        }
    }

    /**
     * Verify that an asset is accessible via HTTP
     * @param {string} path 
     * @param {number} retries 
     */
    async _verifyAssetAccess(path, retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                // Add timestamp to bust cache
                const url = `${path}?t=${Date.now()}`;
                const res = await fetch(url, { method: "HEAD" });
                if (res.ok) return true;
            } catch (e) {
                // ignore
            }
            // Wait 500ms
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return false;
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

        // 3. Remove <defs> blocks
        content = content.replace(/<defs>[\s\S]*?<\/defs>/gi, '');

        // 4. Remove comments
        content = content.replace(/<!--[\s\S]*?-->/g, '');

        // 5. Trim whitespace
        content = content.trim();

        // 6. Ensure xmlns
        if (!content.includes('xmlns="http://www.w3.org/2000/svg"')) {
            content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        return content;
    }
}
