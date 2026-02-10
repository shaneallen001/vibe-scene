/**
 * Dungeongen Service
 * 
 * Generates dungeon maps locally using the integrated dungeongen library.
 * No external API dependency required.
 */

import { generateDungeon } from '../dungeongen/dungeongen.js';

export class DungeongenService {
    constructor(baseUrl) {
        // baseUrl is kept for backward compatibility but not used
        this.baseUrl = baseUrl;
    }

    /**
     * Generate a dungeon image with the given parameters
     * @param {Object} options - Generation options
     * @param {string} options.size - TINY, SMALL, MEDIUM, LARGE, XLARGE
     * @param {string} options.maskType - The overall shape of the dungeon
     * @param {string} options.corridorStyle - Style of corridors
     * @param {string} options.connectivity - Connectivity algorithm
     * @param {number} options.density - Room density (0.1 - 1.0)
     * @param {number} options.seed - Random seed for reproducibility
     * @param {number} options.gridSize - Optional grid size in pixels
     * @param {string} options.deadEndRemoval - NONE, SOME, ALL
     * @param {boolean} options.peripheralEgress - Create exits at edges
     * @param {number} options.doorDensity - 0.0 to 1.0
     * @param {Object} options.stairs - { up: number, down: number }
     * @returns {Promise<Blob>} - PNG image blob
     */
    async generate(options) {
        console.log("Vibe Scenes | Generating dungeon locally with options:", options);

        try {
            // Use integrated local generation
            const blob = await generateDungeon({
                size: options.size,
                maskType: options.maskType,
                corridorStyle: options.corridorStyle,
                connectivity: options.connectivity,
                density: options.density,
                seed: options.seed,
                waterDepth: options.waterDepth,
                seed: options.seed,
                gridSize: options.gridSize || 20,
                deadEndRemoval: options.deadEndRemoval,
                peripheralEgress: options.peripheralEgress,
                doorDensity: options.doorDensity,
                stairs: options.stairs
            });

            console.log("Vibe Scenes | Dungeon generated successfully");
            return blob;

        } catch (error) {
            console.error("Vibe Scenes | Local generation failed:", error);
            throw new Error(`Failed to generate dungeon: ${error.message}`);
        }
    }
}
