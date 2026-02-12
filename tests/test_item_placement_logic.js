
import assert from 'assert';

// Mock Dependencies
class MockAssetLibrary {
    constructor() {
        this.assets = [];
        this.loaded = false;
    }
    async load() { this.loaded = true; }
    getAssets(type) {
        return this.assets.filter(a => a.type === type);
    }
    async registerAsset(asset) {
        this.assets.push(asset);
    }
}

class MockAiService {
    constructor() {
        this.generated = 0;
    }
    async generateSVG(prompt, type) {
        this.generated++;
        return `<svg>${prompt}</svg>`;
    }
    async saveAsset(content, name, type) {
        return `assets/${name}.svg`;
    }
}

// Minimal Room/Grid Mocks
class Room {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.width = w; this.height = h;
    }
}
class DungeonGrid {
    constructor() {
        this.rooms = [];
        this.width = 100;
        this.height = 100;
    }
}

// Logic to Test (extracted from Service)
async function populateRooms(grid, options, library, aiService) {
    const items = [];
    // 1. Get Objects (In real implementation, we await load())
    await library.load();
    let objects = library.getAssets("OBJECT");

    // 2. Fallback Generation
    if (objects.length === 0 && options.generateIfMissing) {
        console.log("No objects found, generating defaults...");
        // In real app, we check settings for API key before calling this
        const defaults = ["wooden crate", "barrel"];
        for (const name of defaults) {
            const svg = await aiService.generateSVG(name, "OBJECT");
            const path = await aiService.saveAsset(svg, name.replace(" ", "_"), "OBJECT");
            await library.registerAsset({ path, type: "OBJECT", id: name });
        }
        objects = library.getAssets("OBJECT");
    }

    if (objects.length === 0) return items;

    // 3. Place Items in Large Rooms
    for (const room of grid.rooms) {
        // Define "Large" as area > 30 (just for test)
        const area = room.width * room.height;
        if (area > 30) {
            const count = Math.floor(Math.random() * 3) + 1; // 1-3 items
            for (let i = 0; i < count; i++) {
                const asset = objects[Math.floor(Math.random() * objects.length)];
                // Random position in room
                const ix = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
                const iy = room.y + 1 + Math.floor(Math.random() * (room.height - 2));

                items.push({
                    x: ix, y: iy,
                    texture: asset.path,
                    width: 1, height: 1,
                    rotation: Math.floor(Math.random() * 4) * 90
                });
            }
        }
    }
    return items;
}

// Test Suite
async function runTests() {
    console.log("Running Item Placement Tests...");

    // Setup
    const library = new MockAssetLibrary();
    const aiService = new MockAiService();
    const grid = new DungeonGrid();

    // Create rooms: 1 small, 1 large
    grid.rooms.push(new Room(0, 0, 4, 4)); // Area 16 (Small)
    grid.rooms.push(new Room(10, 10, 8, 8)); // Area 64 (Large)

    // Test 1: Fallback generation
    console.log("Test 1: Auto-generation when empty");
    const items1 = await populateRooms(grid, { generateIfMissing: true }, library, aiService);

    // Assertions
    assert.strictEqual(aiService.generated, 2, "Should generate 2 default items");
    assert.strictEqual(library.assets.length, 2, "Should register 2 assets");
    assert.ok(items1.length > 0, "Should place items in large room");

    // Test 2: Use existing assets
    console.log("Test 2: Reuse existing assets");
    // Reset generation count to verify it doesn't run again
    const startGen = aiService.generated;
    const items2 = await populateRooms(grid, { generateIfMissing: true }, library, aiService);

    assert.strictEqual(aiService.generated, startGen, "Should NOT generate new items if exists");
    assert.ok(items2.length > 0, "Should place items");

    console.log("All tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
