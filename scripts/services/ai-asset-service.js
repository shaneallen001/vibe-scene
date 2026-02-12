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
        return this._cleanMarkdown(rawText);
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
     * Save a generated asset to the library
     * @param {string} svgContent 
     * @param {string} baseName 
     * @param {string} type 
     * @param {Object} tags - tags to infer style
     */
    async saveAsset(svgContent, baseName, type, tags = []) {
        // This method assumes Browser Environment (Foundry)
        if (typeof FilePicker === "undefined") {
            console.warn("Vibe Scenes | FilePicker not available (Node.js?). Skipping save to library.");
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
            await FilePicker.upload("data", path, file, {}, { notify: false });
            console.log(`Vibe Scenes | Saved asset to ${filePath}`);

            // Register in Library
            await this.library.registerAsset({
                id: baseName,
                path: filePath,
                fileType: "svg",
                source: "ai-gen", // Keeping for internal logic, but migration script handled tags
                tags: ["ai-gen", ...tags],
                type: type,
                width: 1, // Default, should parse from SVG viewbox if possible
                height: 1
            });

            return filePath;
        } catch (e) {
            console.error("Vibe Scenes | Failed to save asset:", e);
            throw e;
        }
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
}
