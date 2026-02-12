import { GeminiService } from "./gemini-service.js";
import { PROMPTS } from "../ai/prompts.js";

export class AiAssetService {
    constructor(apiKey, model) {
        this.gemini = new GeminiService(apiKey, model);
    }

    /**
     * Generate an SVG asset based on a prompt
     * @param {string} prompt - The user's description
     * @param {string} [type="OBJECT"] - The archetype type (TEXTURE, OBJECT, STRUCTURE)
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
