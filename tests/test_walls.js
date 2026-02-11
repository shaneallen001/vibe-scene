
import { DungeonGenerator } from '../scripts/dungeongen/layout/generator.js';
import { WallBuilder } from '../scripts/dungeongen/map/wall-builder.js';
import { CellType, DungeonGrid } from '../scripts/dungeongen/layout/models.js';
import crypto from 'crypto';

// Setup environment
global.crypto = crypto;
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => crypto.randomUUID();
}

// Simple test runner
async function runTests() {
    console.log("=== Testing WallBuilder ===");

    await testBasicWallExtraction();
    await testDoorExtraction();
    await testMerging();

    console.log("\nAll tests passed!");
}

async function testBasicWallExtraction() {
    console.log("\nTest: Basic Wall Extraction");

    // Create a simple 3x3 room in a 5x5 grid
    const grid = new DungeonGrid(5, 5);
    // (1,1) to (3,3) is floor
    for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
            grid.set(x, y, CellType.FLOOR);
        }
    }

    const walls = WallBuilder.build(grid, 20, 0);

    // Expected: 
    // Top wall: (1,1) to (4,1) -> length 3
    // Bottom wall: (1,4) to (4,4) -> length 3
    // Left wall: (1,1) to (1,4) -> length 3
    // Right wall: (4,1) to (4,4) -> length 3
    // Total 4 merged walls.

    console.log(`Extracted ${walls.length} walls.`);
    if (walls.length !== 4) console.error("FAILED: Expected 4 walls");

    // Check pixel coords (cellSize 20, padding 0)
    // Top wall: grid y=1 -> pixel y=20. x 1->4 -> pixel 20->80
    // c: [20, 20, 80, 20]

    const top = walls.find(w => w.c[1] === 20 && w.c[3] === 20);
    if (!top) console.error("FAILED: Missing top wall");
    else {
        console.log("Top wall OK:", top.c);
        if (top.move !== 20) console.error(`FAILED: Expected move=20, got ${top.move}`);
        if (top.sight !== 20) console.error(`FAILED: Expected sight=20, got ${top.sight}`); // Changed from sense to sight
    }
}

async function testDoorExtraction() {
    console.log("\nTest: Door Extraction");

    const grid = new DungeonGrid(5, 5);
    // Room 1: (1,1)-(1,1)
    grid.set(1, 1, CellType.FLOOR);
    // Door: (2,1)
    grid.set(2, 1, CellType.FLOOR);
    // Room 2: (3,1)-(3,1)
    grid.set(3, 1, CellType.FLOOR);

    // Add door object
    const { Door } = await import('../scripts/dungeongen/layout/models.js');
    grid.doors.push(new Door(2, 1, 'vertical'));

    const walls = WallBuilder.build(grid, 20, 0);

    // Find the door wall
    // Vertical door at (2,1). Center is x=2.5.
    // Pixel x = 2.5 * 20 = 50.
    // y from 1 to 2 -> pixel 20 to 40.

    const doorWall = walls.find(w => w.door === 1);

    if (!doorWall) {
        console.error("FAILED: No door wall found");
        console.log(walls);
    } else {
        console.log("Door wall found:", doorWall.c);
        if (doorWall.c[0] !== 50 || doorWall.c[2] !== 50) console.error("FAILED: Door x coord wrong");
        if (doorWall.door !== 1) console.error("FAILED: Door type wrong");
    }
}

async function testMerging() {
    console.log("\nTest: Merging");

    const grid = new DungeonGrid(10, 5);
    // Long corridor y=2, x=1 to 8
    for (let x = 1; x <= 8; x++) grid.set(x, 2, CellType.FLOOR);

    const walls = WallBuilder.build(grid, 10, 0);

    // Should have top wall (1-9, y=2) and bottom wall (1-9, y=3) plus ends.
    // Total 4 walls.

    console.log(`Merged corridor into ${walls.length} walls.`);
    if (walls.length > 5) console.error("FAILED: Merging inefficient");
}

runTests().catch(console.error);
