/**
 * Gemini Service
 * Handles interactions with Google's Gemini API for SVG generation.
 * Includes automatic retry with exponential backoff for rate-limit (429) errors.
 */

// Configuration constants
const GEMINI_API_VERSION = "v1beta";
const BASE_URL = "https://generativelanguage.googleapis.com";

const RETRY_DEFAULTS = {
    maxRetries: 4,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    retryableStatuses: [429, 500, 503]
};

export class GeminiService {
    constructor(apiKey, model = "gemini-3-flash-preview") {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Generate content based on a prompt and optional system instruction
     * @param {string} prompt - The user's input
     * @param {string} systemInstruction - (Optional) System-level context/instructions
     * @param {Object} options - Optional generation overrides
     * @param {string} options.model - Override model name for this request
     * @param {number} options.temperature - Temperature override
     * @param {number} options.maxOutputTokens - Max output tokens override
     * @param {string} options.responseMimeType - Optional response mime type (e.g. application/json)
     * @param {Array<{mimeType: string, data: string}>} options.inlineDataParts - Optional inline binary parts (e.g. images) as base64 strings
     * @returns {Promise<string>} - The generated text response
     */
    async generateContent(prompt, systemInstruction = "", options = {}) {
        if (!this.apiKey) {
            throw new Error("Gemini API Key is not configured.");
        }
        const requestId = `gem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const started = performance.now();
        const model = options?.model || this.model;
        const temperature = Number.isFinite(options?.temperature) ? options.temperature : 0.7;

        // Combine system instruction and prompt if provided
        // Gemini 1.5 Flash supports system instructions via the API, but for simplicity/compatibility
        // with the existing structure, we prepending it to the prompt is often safer unless using the specific system_instruction field.
        // However, v1beta API supports 'system_instruction'. Let's use the robust approach of parts.

        const textPart = systemInstruction ? (systemInstruction + "\n\n" + prompt) : prompt;
        const parts = [{ text: textPart }];
        if (Array.isArray(options?.inlineDataParts)) {
            for (const part of options.inlineDataParts) {
                const mimeType = String(part?.mimeType || "").trim();
                const data = String(part?.data || "").trim();
                if (!mimeType || !data) continue;
                parts.push({
                    inlineData: {
                        mimeType,
                        data
                    }
                });
            }
        }

        const contents = [{
            role: "user",
            parts
        }];

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature
            }
        };
        if (Number.isFinite(options?.maxOutputTokens)) {
            requestBody.generationConfig.maxOutputTokens = options.maxOutputTokens;
        }
        if (typeof options?.responseMimeType === "string" && options.responseMimeType.trim()) {
            requestBody.generationConfig.responseMimeType = options.responseMimeType.trim();
        }

        try {
            console.log(`Vibe Scenes | [${requestId}] Gemini generateContent:start`, {
                model,
                promptLength: String(prompt || "").length,
                hasSystemInstruction: Boolean(systemInstruction),
                inlineParts: parts.length - 1
            });
            const response = await this._callApi(requestBody, 90000, model, options.abortSignal);
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
     * Internal API call wrapper with automatic retry and exponential backoff.
     * Retries on 429 (rate limit), 500, and 503 errors.
     */
    async _callApi(body, timeoutMs = 90000, modelOverride = "", abortSignal = null) {
        const activeModel = modelOverride || this.model;
        const url = `${BASE_URL}/${GEMINI_API_VERSION}/models/${activeModel}:generateContent?key=${this.apiKey}`;
        const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = RETRY_DEFAULTS;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (abortSignal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const onUserAbort = () => controller.abort();
            if (abortSignal) abortSignal.addEventListener("abort", onUserAbort);

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
                clearTimeout(timeout);
                if (abortSignal) abortSignal.removeEventListener("abort", onUserAbort);

                if (abortSignal?.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }
                if (error?.name === "AbortError") {
                    throw new Error(`Gemini API request timed out after ${timeoutMs}ms`);
                }
                throw error;
            } finally {
                clearTimeout(timeout);
                if (abortSignal) abortSignal.removeEventListener("abort", onUserAbort);
            }

            const elapsedMs = Math.round(performance.now() - requestStart);
            console.log("Vibe Scenes | Gemini API response received", {
                model: activeModel,
                status: response.status,
                attempt: attempt + 1,
                elapsedMs
            });

            if (response.ok) {
                return await response.json();
            }

            const isRetryable = retryableStatuses.includes(response.status);
            if (!isRetryable || attempt >= maxRetries) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API Error ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            // Compute backoff: honour Retry-After header if present, else exponential
            let delayMs;
            const retryAfter = response.headers?.get?.("Retry-After");
            if (retryAfter && Number.isFinite(Number(retryAfter))) {
                delayMs = Math.min(Number(retryAfter) * 1000, maxDelayMs);
            } else {
                delayMs = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);
            }
            console.warn(`Vibe Scenes | Gemini API ${response.status} — retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${maxRetries})`, { model: activeModel });
            await new Promise(resolve => {
                const tid = setTimeout(resolve, delayMs);
                if (abortSignal) {
                    abortSignal.addEventListener("abort", () => {
                        clearTimeout(tid);
                        resolve();
                    }, { once: true });
                }
            });
        }
    }
}
