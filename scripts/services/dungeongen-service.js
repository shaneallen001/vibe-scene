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
     * @param {string} options.symmetry - NONE, BILATERAL
     * @param {string} options.waterDepth - DRY, PUDDLES, POOLS, LAKES, FLOODED
     * @param {number} options.seed - Random seed for reproducibility
     * @param {number} options.gridSize - Optional grid size in pixels
     * @returns {Promise<Blob>} - PNG image blob
     */
    async generate(options) {
        console.log("Vibe Scenes | Generating dungeon locally with options:", options);

        try {
            // Use integrated local generation
            const blob = await generateDungeon({
                size: options.size,
                symmetry: options.symmetry,
                waterDepth: options.waterDepth,
                seed: options.seed,
                gridSize: options.gridSize || 20
            });

            console.log("Vibe Scenes | Dungeon generated successfully");
            return blob;

        } catch (error) {
            console.error("Vibe Scenes | Local generation failed:", error);
            throw new Error(`Failed to generate dungeon: ${error.message}`);
        }
    }
}
