
import crypto from 'node:crypto';
if (!global.crypto) {
    global.crypto = crypto;
}

import { DungeonGenerator } from '../scripts/dungeongen/layout/generator.js';
import { CellType, DungeonGrid } from '../scripts/dungeongen/layout/models.js';
import { pruneDeadEnds } from '../scripts/dungeongen/layout/connectivity.js';

function countDeadEnds(grid) {
    let count = 0;
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            if (grid.get(x, y) === CellType.FLOOR) {
                let neighbors = 0;
                if (grid.get(x, y - 1) === CellType.FLOOR) neighbors++;
                if (grid.get(x, y + 1) === CellType.FLOOR) neighbors++;
                if (grid.get(x - 1, y) === CellType.FLOOR) neighbors++;
                if (grid.get(x + 1, y) === CellType.FLOOR) neighbors++;
                if (neighbors === 1) count++;
            }
        }
    }
    return count;
}

function hasPeripheralEgress(grid) {
    // Check borders for FLOOR (exits dig to edge)
    for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, 0) === CellType.FLOOR || grid.get(x, grid.height - 1) === CellType.FLOOR) return true;
    }
    for (let y = 0; y < grid.height; y++) {
        if (grid.get(0, y) === CellType.FLOOR || grid.get(grid.width - 1, y) === CellType.FLOOR) return true;
    }
    return false;
}

async function testOptions() {
    console.log("=== Verification: Dungeon Generator Options ===");

    // Test 1: Shape (Mask Type)
    console.log("\n1. Testing Shape (Round)...");
    const genRound = new DungeonGenerator(60, 60, {
        size: 'small',
        maskType: 'round',
        seed: 123
    });
    const gridRound = genRound.generate();
    // Check corners. In a round mask, corners (e.g. 0,0) should be void (0).
    const cornerValid = gridRound.getMask(0, 0);
    const centerValid = gridRound.getMask(30, 30);

    console.log(`   - Corner (0,0) mask value: ${cornerValid} (Expected 0)`);
    console.log(`   - Center (30,30) mask value: ${centerValid} (Expected 1)`);
    if (cornerValid === 0 && centerValid === 1) console.log("   ✅ Round mask applied.");
    else console.log("   ❌ Round mask failed.");

    // Test 2: Room Density
    console.log("\n2. Testing Room Density...");
    const genLow = new DungeonGenerator(60, 60, { density: 0.1, seed: 111 });
    const gridLow = genLow.generate();
    console.log(`   - Density 0.1 -> ${gridLow.rooms.length} rooms`);

    const genHigh = new DungeonGenerator(60, 60, { density: 0.9, seed: 111 });
    const gridHigh = genHigh.generate();
    console.log(`   - Density 0.9 -> ${gridHigh.rooms.length} rooms`);

    if (gridHigh.rooms.length > gridLow.rooms.length) console.log("   ✅ Density control works.");
    else console.log("   ❌ Density control failed.");

    // Test 3: Connectivity
    console.log("\n3. Testing Connectivity...");
    // Hard to verify graph topology without deep inspection, but can check corridor style usage or errors.
    const genMST = new DungeonGenerator(40, 40, { connectivity: 'mst', seed: 222 });
    try {
        const gridMST = genMST.generate();
        console.log("   ✅ MST generation successful.");
    } catch (e) {
        console.log("   ❌ MST generation failed: " + e);
    }

    const genFull = new DungeonGenerator(40, 40, { connectivity: 'full', seed: 222 });
    try {
        const gridFull = genFull.generate();
        console.log("   ✅ Full connectivity generation successful.");
    } catch (e) {
        console.log("   ❌ Full connectivity generation failed: " + e);
    }

    console.log("\n=== specific verification finished ===");
}

testOptions();
