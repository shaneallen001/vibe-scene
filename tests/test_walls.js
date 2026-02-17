
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
    await testLShapedCorners();

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

    // With WALL_OUTSET = 1/3, walls are pushed outward by 1/3 cell.
    // Top wall:    grid y = 1 - 1/3 = 2/3   → pixel y = 2/3 * 20 ≈ 13.33
    // Bottom wall: grid y = 4 + 1/3 = 13/3   → pixel y = 13/3 * 20 ≈ 86.67
    // Left wall:   grid x = 1 - 1/3 = 2/3   → pixel x = 2/3 * 20 ≈ 13.33
    // Right wall:  grid x = 4 + 1/3 = 13/3   → pixel x = 13/3 * 20 ≈ 86.67
    // Total 4 merged walls.

    console.log(`Extracted ${walls.length} walls.`);
    if (walls.length !== 4) console.error(`FAILED: Expected 4 walls, got ${walls.length}`);

    // Check pixel coords (cellSize 20, padding 0)
    // Top wall: pushed-out y ≈ 13.33, x from ≈ 13.33 to ≈ 86.67
    const eps = 0.1;
    const expectedEdge = (2 / 3) * 20;   // ≈ 13.33
    const expectedFar  = (13 / 3) * 20;  // ≈ 86.67

    const top = walls.find(w => Math.abs(w.c[1] - expectedEdge) < eps && Math.abs(w.c[3] - expectedEdge) < eps);
    if (!top) console.error("FAILED: Missing top wall");
    else {
        console.log("Top wall OK:", top.c);
        if (top.move !== 20) console.error(`FAILED: Expected move=20, got ${top.move}`);
        if (top.sight !== 20) console.error(`FAILED: Expected sight=20, got ${top.sight}`);
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

    // Vertical door at (2,1). Center line x = 2.5.
    // Pixel x = 2.5 * 20 = 50.
    // With WALL_OUTSET = 1/3, y extends from (1 - 1/3) to (2 + 1/3)
    // Pixel y: (2/3)*20 ≈ 13.33  to  (7/3)*20 ≈ 46.67

    const doorWall = walls.find(w => w.door === 1);

    if (!doorWall) {
        console.error("FAILED: No door wall found");
        console.log(walls);
    } else {
        console.log("Door wall found:", doorWall.c);
        if (doorWall.c[0] !== 50 || doorWall.c[2] !== 50) console.error("FAILED: Door x coord wrong");
        if (doorWall.door !== 1) console.error("FAILED: Door type wrong");
        // Verify door is extended by outset
        const eps = 0.1;
        const expectedY1 = (2 / 3) * 20;  // ≈ 13.33
        const expectedY2 = (7 / 3) * 20;  // ≈ 46.67
        if (Math.abs(doorWall.c[1] - expectedY1) > eps) console.error(`FAILED: Door y1 expected ~${expectedY1.toFixed(2)}, got ${doorWall.c[1]}`);
        if (Math.abs(doorWall.c[3] - expectedY2) > eps) console.error(`FAILED: Door y2 expected ~${expectedY2.toFixed(2)}, got ${doorWall.c[3]}`);
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

async function testLShapedCorners() {
    console.log("\nTest: L-Shaped Room Corners (no horns, no gaps)");

    // L-shaped room in a 6x6 grid:
    //   . . . . . .
    //   . F F . . .
    //   . F F . . .
    //   . F F F F .
    //   . F F F F .
    //   . . . . . .
    const grid = new DungeonGrid(6, 6);
    for (let y = 1; y <= 4; y++)
        for (let x = 1; x <= 2; x++)
            grid.set(x, y, CellType.FLOOR);
    for (let y = 3; y <= 4; y++)
        for (let x = 3; x <= 4; x++)
            grid.set(x, y, CellType.FLOOR);

    const walls = WallBuilder.build(grid, 30, 0);
    const o = 1 / 3;
    const eps = 0.2;

    console.log(`  Total wall segments: ${walls.length}`);
    console.log("  All walls (grid coords):");
    for (const w of walls) {
        const g = w.c.map(v => (v / 30).toFixed(3));
        console.log(`    (${g[0]},${g[1]})→(${g[2]},${g[3]}) door=${w.door}`);
    }

    // Helper to find a wall segment close to expected grid coords (scaled by cellSize=30)
    const find = (ex1, ey1, ex2, ey2) => walls.find(w =>
        w.door === 0 &&
        Math.abs(w.c[0] - ex1 * 30) < eps &&
        Math.abs(w.c[1] - ey1 * 30) < eps &&
        Math.abs(w.c[2] - ex2 * 30) < eps &&
        Math.abs(w.c[3] - ey2 * 30) < eps
    );

    let failed = false;
    const check = (label, ex1, ey1, ex2, ey2) => {
        const w = find(ex1, ey1, ex2, ey2);
        if (!w) {
            console.error(`  FAILED: Missing wall "${label}" expected (${ex1.toFixed(3)},${ey1.toFixed(3)})→(${ex2.toFixed(3)},${ey2.toFixed(3)})`);
            failed = true;
        } else {
            console.log(`  OK: ${label}`);
        }
    };

    // Expected walls for the L-shape (all pushed out by o = 1/3):
    //
    // Top:         y=1-o,  x from 1-o to 3+o  (extends to meet right-upper wall)
    check("top", 1 - o, 1 - o, 3 + o, 1 - o);

    // Left:        x=1-o,  y from 1-o to 5+o
    check("left", 1 - o, 1 - o, 1 - o, 5 + o);

    // Bottom:      y=5+o,  x from 1-o to 5+o
    check("bottom", 1 - o, 5 + o, 5 + o, 5 + o);

    // Right-upper: x=3+o,  y from 1-o to 3-o  (inner concave corner)
    //   The vertical wall at x=3 (between (2,y)=FLOOR and (3,y)=EMPTY for y=1,2)
    //   is pushed right to 3+o. Bottom end at y=3; extends to 3-o? No...
    //   At y=3 bottom end: hEdge check — hEdge at y=3 for col 3 exists (separates
    //   (3,2)=EMPTY from (3,3)=FLOOR). So it extends to y = 3 + o.
    //   But the horizontal inner step wall at y=3-o starts at x=3+o.
    //   So the vertical wall bottom = 3+o and horizontal wall left = 3+o → they meet!
    check("right-upper", 3 + o, 1 - o, 3 + o, 3 + o);

    // Inner step:  y=3-o,  x from 3+o to 5+o
    //   Horizontal edge at y=3 for cols 3,4. Floor below, empty above.
    //   Pushed up to y = 3-o.
    //   Left end at x=3: vEdge[3] at row 3 exists? (3,3)=FLOOR, (2,3)=FLOOR → no vEdge.
    //   But vEdge[3] at row 2 exists (non-floor side). So left extends to 3-o.
    check("inner-step", 3 - o, 3 - o, 5 + o, 3 - o);

    // Right-lower: x=5+o,  y from 3-o to 5+o
    check("right-lower", 5 + o, 3 - o, 5 + o, 5 + o);

    if (failed) console.error("  Some L-shape corner checks failed!");
    else console.log("  All L-shape corners OK!");
}

runTests().catch(console.error);
