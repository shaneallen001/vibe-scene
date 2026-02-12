
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// --- Mock Browser Environment ---
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.fetch = async () => ({ ok: true, json: async () => ({}) }); // Mock fetch
global.crypto = crypto;
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => crypto.randomUUID();
}
global.ui = { notifications: { info: () => { }, error: () => { } } };

// Mock Game Global with API Key
global.game = {
    settings: {
        get: (module, key) => {
            if (key === 'geminiApiKey') return "MOCK_API_KEY"; // Enable AI path
            if (key === 'geminiModel') return "mock-model";
            if (key === 'defaultGridSize') return 20;
            return null;
        }
    }
};

// Setup Mock Canvas
global.window.HTMLCanvasElement.prototype.getContext = () => ({
    translate: () => { }, fillRect: () => { }, drawImage: () => { },
    imageSmoothingEnabled: false, createPattern: () => ({}),
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '',
    beginPath: () => { }, moveTo: () => { }, lineTo: () => { },
    stroke: () => { }, fillText: () => { }, strokeText: () => { }, measureText: () => ({ width: 0 }),
});
global.window.HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob([], { type: 'image/png' }));


// --- MOCK SERVICE DEPENDENCIES ---
// We need to intercept AiAssetService constructor to return our mock
// But we are importing standard ES modules.

// Solution: We will create a fresh test file that imports the service, 
// but we need to mock the AiAssetService class logic.
// The DungeongenService imports AiAssetService *inside* the module scope.
// We can't easily mock it without a proper test runner.

// However, we can mock `game.settings.get` to return an API Key, 
// AND we can rely on `AiAssetService` being imported.
// But we don't want to make real API calls.
// We need to monkey-patch `AiAssetService.prototype.suggestRoomContents`.

const { DungeongenService } = await import('../scripts/services/dungeongen-service.js');
const { AiAssetService } = await import('../scripts/services/ai-asset-service.js');

// MONKEY PATCH
AiAssetService.prototype.suggestRoomContents = async function (roomData, availableAssets) {
    console.log("MOCK: Suggesting room contents for", roomData);
    console.log("MOCK: Available assets received:", availableAssets);

    // Check if availableAssets contains expected items
    if (availableAssets && availableAssets.includes('mock_throne')) {
        console.log("MOCK: Verification passed - 'mock_throne' is in available assets.");
    } else {
        console.error("MOCK: Verification FAILED - 'mock_throne' missing from available assets.");
    }

    // Return a fixed item list
    return [
        { name: "Mock Throne", original_id: "mock_throne", x: 2, y: 2, rotation: 0 },
        { name: "Mock Chest", x: 0, y: 0, rotation: 90 }
    ];
};

AiAssetService.prototype.generateSVG = async () => "<svg></svg>";
AiAssetService.prototype.saveAsset = async () => "mock/path/item.svg";


async function test() {
    console.log("Testing AI Room Population...");

    const service = new DungeongenService();

    // Mock Library
    service.library = {
        load: async () => { },
        getAssets: (type) => {
            return [{ id: "mock_throne", path: 'assets/throne.svg', type: 'OBJECT', tags: ['throne'] }];
        }
    };

    const options = {
        size: 'small', // Small map to be fast
        gridSize: 20,
        seed: 12345
    };

    // 1. Generate
    // This will trigger internal `_populateRooms`
    const result = await service.generate(options);

    console.log(`Generated ${result.items.length} items.`);

    // 2. Verify AI Items
    // We expect "Mock Throne" to be placed.
    // The library has "mock_throne". 
    // Logic: find exact ID match -> "Mock Throne" != "mock_throne" (id match uses name lower replace space with underscore)
    // "Mock Throne" -> "mock_throne" === "mock_throne"? YES.

    // Coordinate check:
    // Room x,y + item x,y + padding.
    // We don't know exact room x,y without digging into grid, but we can check if we have items.

    if (result.items.length > 0) {
        console.log("SUCCESS: Items generated via AI path.");
        // Check if any item uses the throne texture
        const throne = result.items.find(i => i.texture === 'assets/throne.svg');
        if (throne) {
            console.log("Found the throne! AI population worked.");
        } else {
            console.error("Throne not found. Did fallback kick in?");
            process.exit(1);
        }
    } else {
        console.error("No items generated.");
        process.exit(1);
    }
}

test();
