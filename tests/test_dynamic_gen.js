import { GeminiService } from '../scripts/services/gemini-service.js';
import { PROMPTS } from '../scripts/ai/prompts.js';
import fs from 'fs';
import path from 'path';

// Mocks
const game = {
    settings: {
        get: (module, key) => {
            if (key === 'geminiApiKey') return process.env.GEMINI_API_KEY || "TEST_KEY";
            if (key === 'geminiModel') return "gemini-2.5-flash";
        }
    }
};

const ui = {
    notifications: {
        info: (msg) => console.log("[UI INFO]", msg),
        warn: (msg) => console.log("[UI WARN]", msg),
        error: (msg) => console.error("[UI ERROR]", msg)
    }
};

// Mock library
const library = {
    assets: [],
    getAssets: () => library.assets,
    load: async () => { console.log("[LIB] Library reloaded."); },
    registerAsset: async (asset) => {
        console.log(`[LIB] Registered: ${asset.id}`);
        library.assets.push(asset);
    }
};

// Simplified Service
class TestAiAssetService {
    constructor(apiKey, model) {
        this.gemini = new GeminiService(apiKey, model);
        this.library = library;
    }

    async generateSVG(prompt, type) {
        if (this.gemini.apiKey === "TEST_KEY") return "<svg>MOCK</svg>";
        const baseSystem = PROMPTS._BASE;
        const typeSystem = PROMPTS[`SVG_${type}`] || PROMPTS.SVG_OBJECT;
        return this._cleanMarkdown(await this.gemini.generateContent(prompt, baseSystem + "\n" + typeSystem));
    }

    async saveAsset(svg, name, type, tags) {
        console.log(`[SAVE] Saving ${name}...`);
        // Simulate save
        const filePath = `assets/${type.toLowerCase()}/${name}.svg`;
        await this.library.registerAsset({ id: name, path: filePath, tags });
        return filePath;
    }

    async planDungeon(rooms, available) {
        // Mock a response with a wishlist
        return {
            plan: [],
            wishlist: [
                { name: "Obsidian Throne", type: "OBJECT", visual_style: "Dark, jagged" },
                { name: "Bone Chandelier", type: "OBJECT", visual_style: "Spooky" }
            ]
        };
    }

    _cleanMarkdown(text) { return text.replace(/```/g, ""); }
}

async function runTest() {
    console.log("Starting Dynamic Generation Test...");

    // Config
    const configPath = path.resolve('./tests/config.json');
    let apiKey = "TEST_KEY";
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        apiKey = config.apiKey;
    }

    const aiService = new TestAiAssetService(apiKey, "gemini-2.5-flash");

    // Simulate DungeongenService logic
    console.log("1. Planning...");
    const { wishlist } = await aiService.planDungeon([], []);
    console.log("Wishlist received:", wishlist);

    if (wishlist.length > 0) {
        console.log(`2. Processing ${wishlist.length} new items...`);

        for (const item of wishlist) {
            console.log(`\n--- Generating: ${item.name} ---`);
            try {
                const svg = await aiService.generateSVG(item.name, "OBJECT");
                console.log(`SVG Generated (${svg.length} chars)`);
                await aiService.saveAsset(svg, item.name.replace(" ", "_"), "OBJECT", ["auto"]);
            } catch (e) {
                console.error("Failed:", e);
            }
        }

        console.log("\n3. Reloading Library...");
        await library.load();
        console.log("Final Assets:", library.assets.map(a => a.id));
    }
}

runTest();
