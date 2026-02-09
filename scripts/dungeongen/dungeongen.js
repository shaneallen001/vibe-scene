/**
 * Dungeongen - Main Entry Point
 * 
 * Procedural dungeon generation for Foundry VTT.
 * JavaScript port of the dungeongen Python library.
 */

import { DungeonGenerator } from './layout/generator.js';
import { GenerationParams, DungeonSize, SymmetryType, WaterDepth } from './layout/params.js';
import { DungeonRenderer } from './map/renderer.js';

// Re-export for external use
export { DungeonGenerator } from './layout/generator.js';
export { DungeonRenderer } from './map/renderer.js';
export { GenerationParams, DungeonSize, SymmetryType, WaterDepth } from './layout/params.js';
export { Room, Passage, Door, Dungeon, RoomShape, DoorType } from './layout/models.js';

/**
 * Generate a dungeon and render it to a PNG blob
 * 
 * @param {Object} options - Generation options
 * @param {string} options.size - Size preset: TINY, SMALL, MEDIUM, LARGE, XLARGE
 * @param {string} options.symmetry - Symmetry type: NONE, BILATERAL
 * @param {string} options.waterDepth - Water depth: DRY, PUDDLES, POOLS, LAKES, FLOODED
 * @param {number} options.seed - Random seed for reproducibility
 * @param {number} options.gridSize - Pixels per grid cell (for rendering)
 * @returns {Promise<Blob>} - PNG image blob
 */
export async function generateDungeon(options = {}) {
    console.log("Dungeongen | Starting generation with options:", options);

    const startTime = performance.now();

    // Parse options
    const params = GenerationParams.fromOptions({
        size: options.size || 'medium',
        symmetry: options.symmetry || 'none',
        waterDepth: options.waterDepth || 'dry',
        seed: options.seed
    });
    console.log("Dungeongen | Parsed params:", params);

    // Generate layout
    const generator = new DungeonGenerator(params);
    console.log("Dungeongen | Generator created, generating dungeon...");
    const dungeon = generator.generate(options.seed);

    console.log(`Dungeongen | Generated ${dungeon.rooms.length} rooms, ${dungeon.passages.length} passages`);
    console.log("Dungeongen | Dungeon bounds:", dungeon.bounds);
    if (dungeon.rooms.length > 0) {
        console.log("Dungeongen | First room:", dungeon.rooms[0]);
    }

    // Render to image
    const renderer = new DungeonRenderer(dungeon, {
        cellSize: options.gridSize || 20,
        drawGrid: true,
        drawNumbers: true
    });
    console.log("Dungeongen | Renderer created, rendering to blob...");

    const blob = await renderer.renderToBlob();
    console.log("Dungeongen | Blob created, size:", blob.size, "bytes");

    const endTime = performance.now();
    console.log(`Dungeongen | Generation complete in ${(endTime - startTime).toFixed(0)}ms`);

    return blob;
}

/**
 * Generate dungeon and return both layout data and image
 * 
 * @param {Object} options - Generation options
 * @returns {Promise<{dungeon: Dungeon, blob: Blob}>}
 */
export async function generateDungeonWithData(options = {}) {
    const params = GenerationParams.fromOptions({
        size: options.size || 'medium',
        symmetry: options.symmetry || 'none',
        waterDepth: options.waterDepth || 'dry',
        seed: options.seed
    });

    const generator = new DungeonGenerator(params);
    const dungeon = generator.generate(options.seed);

    const renderer = new DungeonRenderer(dungeon, {
        cellSize: options.gridSize || 20,
        drawGrid: true,
        drawNumbers: true
    });

    const blob = await renderer.renderToBlob();

    return { dungeon, blob };
}

/**
 * Render an existing dungeon layout to image
 * 
 * @param {Dungeon} dungeon - Dungeon layout to render
 * @param {Object} options - Rendering options
 * @returns {Promise<Blob>} - PNG image blob
 */
export async function renderDungeon(dungeon, options = {}) {
    const renderer = new DungeonRenderer(dungeon, {
        cellSize: options.gridSize || 20,
        drawGrid: options.drawGrid ?? true,
        drawNumbers: options.drawNumbers ?? true
    });

    return await renderer.renderToBlob();
}
