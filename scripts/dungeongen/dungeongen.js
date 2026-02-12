/**
 * Dungeongen - Main Entry Point
 * 
 * Procedural dungeon generation for Foundry VTT.
 * Grid-based generation system.
 */

import { DungeonGenerator } from './layout/generator.js';
import { DungeonRenderer } from './map/renderer.js';
import { WallBuilder } from './map/wall-builder.js';

// Re-export for external use - Note: Models have changed!
export { DungeonGenerator } from './layout/generator.js';
export { DungeonRenderer } from './map/renderer.js';
export { CellType, DungeonGrid, Room, Door } from './layout/models.js';

/**
 * Size presets for dungeon generation
 */
const SIZE_PRESETS = {
    tiny: { width: 40, height: 40, numRooms: 5, minSize: 5, maxSize: 10, stairs: { up: 0, down: 1 } },
    small: { width: 60, height: 60, numRooms: 10, minSize: 6, maxSize: 12, stairs: { up: 1, down: 1 } },
    medium: { width: 90, height: 90, numRooms: 20, minSize: 8, maxSize: 15, stairs: { up: 1, down: 2 } },
    large: { width: 120, height: 120, numRooms: 35, minSize: 10, maxSize: 20, stairs: { up: 1, down: 2 } },
    xlarge: { width: 160, height: 160, numRooms: 50, minSize: 12, maxSize: 25, stairs: { up: 2, down: 3 } },
    huge: { width: 200, height: 200, numRooms: 75, minSize: 15, maxSize: 30, stairs: { up: 2, down: 4 } }
};

/**
 * Generate a dungeon and render it to a PNG blob
 * 
 * @param {Object} options - Generation options
 * @param {string} options.size - Size preset: TINY, SMALL, MEDIUM, LARGE, XLARGE
 * @param {number} options.seed - Random seed (not fully implemented in new gen yet)
 * @param {number} options.gridSize - Pixels per grid cell (for rendering)
 * @returns {Promise<Object>} - { blob, walls }
 */
export async function generateDungeon(options = {}) {
    console.log("Dungeongen | Starting generation with options:", options);

    const startTime = performance.now();

    // 1. Resolve configuration from options
    const sizeName = (options.size || 'medium').toLowerCase();
    const config = SIZE_PRESETS[sizeName] || SIZE_PRESETS.medium;

    // 2. Generate
    const generator = new DungeonGenerator(config.width, config.height, {
        numRooms: config.numRooms,
        minRoomSize: config.minSize,
        maxRoomSize: config.maxSize,
        maskType: options.maskType || 'rectangle',
        density: options.density,
        roomSizeBias: options.roomSizeBias,
        placementAlgorithm: options.placementAlgorithm,
        connectivity: options.connectivity,
        corridorStyle: options.corridorStyle,
        deadEndRemoval: options.deadEndRemoval,
        peripheralEgress: options.peripheralEgress,
        stairs: options.stairs || config.stairs,
        doorDensity: options.doorDensity
    });

    console.log(`Dungeongen | Generating ${sizeName} dungeon (${config.width}x${config.height})...`);
    const grid = generator.generate();

    console.log(`Dungeongen | Generated ${grid.rooms.length} rooms and ${grid.doors.length} doors`);

    // 3. Render
    const renderer = new DungeonRenderer(grid, {
        cellSize: options.gridSize || 20,
        drawNumbers: false,
        cellSize: options.gridSize || 20,
        drawNumbers: false,
        floorTexture: options.floorTexture || 'modules/vibe-scenes/assets/generated/texture/floor_stone_block_large.svg'
    });

    console.log("Dungeongen | Rendering to blob...");
    const blob = await renderer.renderToBlob();

    // 4. Extract Walls
    const pad = options.gridSize * 2 || 40; // match renderer padding logic
    const walls = WallBuilder.build(grid, options.gridSize || 20, pad);
    console.log(`Dungeongen | Extracted ${walls.length} wall segments`);

    const endTime = performance.now();
    console.log(`Dungeongen | Generation complete in ${(endTime - startTime).toFixed(0)}ms`);

    return { blob, walls };
}

/**
 * Generate dungeon and return both layout data and image
 * Note: 'dungeon' return value is now a DungeonGrid, not the old Dungeon model
 */
export async function generateDungeonWithData(options = {}) {
    // 1. Resolve configuration from options
    const sizeName = (options.size || 'medium').toLowerCase();
    const config = SIZE_PRESETS[sizeName] || SIZE_PRESETS.medium;

    // 2. Generate
    const generator = new DungeonGenerator(config.width, config.height, {
        numRooms: config.numRooms,
        minRoomSize: config.minSize,
        maxRoomSize: config.maxSize,
        maskType: options.maskType || 'rectangle',
        density: options.density,
        roomSizeBias: options.roomSizeBias,
        placementAlgorithm: options.placementAlgorithm,
        connectivity: options.connectivity,
        corridorStyle: options.corridorStyle,
        deadEndRemoval: options.deadEndRemoval,
        peripheralEgress: options.peripheralEgress,
        stairs: options.stairs || config.stairs,
        doorDensity: options.doorDensity
    });

    const grid = generator.generate();

    // 3. Render
    const renderer = new DungeonRenderer(grid, {
        cellSize: options.gridSize || 20,
        drawNumbers: true,
        cellSize: options.gridSize || 20,
        drawNumbers: true,
        floorTexture: options.floorTexture || 'modules/vibe-scenes/assets/generated/texture/floor_stone_block_large.svg'
    });

    const blob = await renderer.renderToBlob();

    // 4. Extract Walls
    const pad = options.gridSize * 2 || 40;
    const walls = WallBuilder.build(grid, options.gridSize || 20, pad);

    return { dungeon: grid, blob, walls };
}
