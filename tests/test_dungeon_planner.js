
import { AiAssetService } from '../scripts/services/ai-asset-service.js';
import fs from 'fs';
import path from 'path';

// Mock the Foundry environment globals if needed
global.game = {
    settings: {
        get: (module, key) => {
            if (key === "geminiApiKey") return process.env.GEMINI_API_KEY;
            if (key === "geminiModel") return "gemini-1.5-flash";
        }
    }
};

// Simple fetch polyfill if needed (Node 18+ has fetch)
// ...

async function runTest() {
    // Load config for API key
    const configPath = path.join(process.cwd(), 'tests', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error("No config.json found in tests/. Please create one with { \"apiKey\": \"...\" }");
        return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const apiKey = config.apiKey;

    const aiService = new AiAssetService(apiKey, 'gemini-2.5-flash');

    // MOCK DATA: A small 3-room dungeon
    // Room A (Large Hub) connected to Room B (Small) and Room C (Medium)
    const rooms = [
        { id: "room_A", width: 10, height: 10, connections: ["room_B", "room_C"] },
        { id: "room_B", width: 4, height: 4, connections: ["room_A"] },
        { id: "room_C", width: 6, height: 8, connections: ["room_A"] }
    ];

    const availableAssets = [
        "wooden_table", "wooden_chair", "stone_throne", "bed_roll",
        "chest_iron", "barrel_large", "torch_standing", "bookshelf_full"
    ];

    console.log("Testing planDungeon with 3 rooms...");
    const plan = await aiService.planDungeon(rooms, availableAssets);

    console.log("\n--- AI Dungeon Plan ---");
    console.log(JSON.stringify(plan, null, 2));

    // Verification
    if (!Array.isArray(plan)) {
        console.error("FAIL: Plan is not an array");
        return;
    }

    if (plan.length !== 3) {
        console.warn(`WARNING: Expected 3 rooms in plan, got ${plan.length}`);
    }

    const themes = plan.map(r => r.theme);
    console.log("Themes assigned:", themes);
}

runTest().catch(console.error);
