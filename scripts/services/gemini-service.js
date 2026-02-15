/**
 * Gemini Service
 * Handles interactions with Google's Gemini API for SVG generation
 */

// Configuration constants
const GEMINI_API_VERSION = "v1beta";
const BASE_URL = "https://generativelanguage.googleapis.com";

export class GeminiService {
    constructor(apiKey, model = "gemini-3-flash-preview") {
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
        const requestId = `gem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const started = performance.now();

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
            console.log(`Vibe Scenes | [${requestId}] Gemini generateContent:start`, {
                model: this.model,
                promptLength: String(prompt || "").length,
                hasSystemInstruction: Boolean(systemInstruction)
            });
            const response = await this._callApi(requestBody);
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log(`Vibe Scenes | [${requestId}] Gemini generateContent:success`, {
                elapsedMs: Math.round(performance.now() - started),
                candidates: response?.candidates?.length || 0,
                textChars: text.length
            });
            return text; // Return raw text, let caller handle cleaning
        } catch (error) {
            console.error(`Vibe Scenes | [${requestId}] Gemini generateContent:failed`, error);
            throw error;
        }
    }

    /**
     * Internal API call wrapper with basic error handling
     */
    async _callApi(body, timeoutMs = 90000) {
        const url = `${BASE_URL}/${GEMINI_API_VERSION}/models/${this.model}:generateContent?key=${this.apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const requestStart = performance.now();
        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } catch (error) {
            if (error?.name === "AbortError") {
                throw new Error(`Gemini API request timed out after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
        console.log("Vibe Scenes | Gemini API response received", {
            model: this.model,
            status: response.status,
            elapsedMs: Math.round(performance.now() - requestStart)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API Error ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        return await response.json();
    }


}
