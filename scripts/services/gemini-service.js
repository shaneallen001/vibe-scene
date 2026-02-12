/**
 * Gemini Service
 * Handles interactions with Google's Gemini API for SVG generation
 */

// Configuration constants
const GEMINI_API_VERSION = "v1beta";
const BASE_URL = "https://generativelanguage.googleapis.com";

export class GeminiService {
    constructor(apiKey, model = "gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Generate content based on a prompt and optional system instruction
     * @param {string} prompt - The user's input
     * @param {string} systemInstruction - (Optional) System-level context/instructions
     * @returns {Promise<string>} - The generated text response
     */
    async generateContent(prompt, systemInstruction = "") {
        if (!this.apiKey) {
            throw new Error("Gemini API Key is not configured.");
        }

        // Combine system instruction and prompt if provided
        // Gemini 1.5 Flash supports system instructions via the API, but for simplicity/compatibility
        // with the existing structure, we prepending it to the prompt is often safer unless using the specific system_instruction field.
        // However, v1beta API supports 'system_instruction'. Let's use the robust approach of parts.

        const contents = [];

        if (systemInstruction) {
            // For v1beta, system instructions are often passed as a separate field or just prepended.
            // We'll prepend it to the user prompt to ensure it's handled effectively by all models including those that might treat system_instruction strictly.
            // Or better, let's just use the 'contents' array structure.
            contents.push({
                role: "user",
                parts: [{ text: systemInstruction + "\n\n" + prompt }]
            });
        } else {
            contents.push({
                role: "user",
                parts: [{ text: prompt }]
            });
        }

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.7
            }
        };

        try {
            const response = await this._callApi(requestBody);
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return text; // Return raw text, let caller handle cleaning
        } catch (error) {
            console.error("Vibe Scenes | Gemini Generation Error:", error);
            throw error;
        }
    }

    /**
     * Internal API call wrapper with basic error handling
     */
    async _callApi(body) {
        const url = `${BASE_URL}/${GEMINI_API_VERSION}/models/${this.model}:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        return await response.json();
    }


}
