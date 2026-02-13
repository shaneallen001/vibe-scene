import { GeminiService } from '../scripts/services/gemini-service.js';
import { PROMPTS } from '../scripts/ai/prompts.js';
import fs from 'fs';
import path from 'path';

// Mocks
const game = {
    settings: {
        get: (module, key) => {
            if (key === 'geminiApiKey') return process.env.GEMINI_API_KEY || "TEST_KEY";
            if (key === 'geminiModel') return "gemini-1.5-flash";
        }
    }
};

const ui = {
    notifications: {
        info: (msg) => console.log("[INFO]", msg),
        warn: (msg) => console.log("[WARN]", msg),
        error: (msg) => console.error("[ERROR]", msg)
    }
};

// Simplified AiAssetService for Node testing
class TestAiAssetService {
    constructor(apiKey, model) {
        this.gemini = new GeminiService(apiKey, model);
    }

    async generateSVG(prompt, type = "OBJECT") {
        const baseSystem = PROMPTS._BASE;
        const typeSystem = PROMPTS[`SVG_${type}`] || PROMPTS.SVG_OBJECT;
        const fullSystemPrompt = `${baseSystem}\n\n${typeSystem}`;
        // Mock actual call if no key
        if (this.gemini.apiKey === "TEST_KEY") {
            return `<svg viewBox="0 0 512 512"><rect width="512" height="512" fill="red"/></svg>`;
        }
        const rawText = await this.gemini.generateContent(prompt, fullSystemPrompt);
        return this._cleanMarkdown(rawText);
    }

    _cleanMarkdown(text) {
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
            const lines = cleaned.split("\n");
            lines.shift();
            if (lines[lines.length - 1].trim().startsWith("```")) lines.pop();
            cleaned = lines.join("\n").trim();
        }
        return cleaned;
    }
}

async function runTest() {
    console.log("Starting Vibe Studio Simulation...");

    // Load config
    const configPath = path.resolve('./tests/config.json');
    let apiKey = "TEST_KEY";
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        apiKey = config.apiKey;
    }

    const service = new TestAiAssetService(apiKey, "gemini-2.5-flash");
    const count = 2;
    const prompt = "A test artifact";
    const type = "OBJECT";

    console.log(`Generating ${count} assets...`);

    for (let i = 0; i < count; i++) {
        let currentPrompt = prompt;
        if (count > 1) currentPrompt += `\nVariation: ${i + 1}`;

        try {
            console.log(`Requesting variation ${i + 1}...`);
            const svg = await service.generateSVG(currentPrompt, type);
            console.log(`Generated SVG (length: ${svg.length})`);

            const fileName = `test_artifact_${Date.now()}_${i}.svg`;
            const outPath = path.join('./tests/output', fileName);
            if (!fs.existsSync('./tests/output')) fs.mkdirSync('./tests/output');

            // Write to file (simulating saveAsset)
            fs.writeFileSync(outPath, svg);
            console.log(`Saved to ${outPath}`);
        } catch (err) {
            console.error("Failed:", err);
        }
    }
    console.log("Test Complete.");
}

runTest();
