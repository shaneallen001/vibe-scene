/**
 * Dungeongen Service
 * 
 * Generates dungeon maps locally using the integrated dungeongen library.
 * No external API dependency required.
 */


import { generateDungeonWithData } from '../dungeongen/dungeongen.js';
import { AssetLibraryService } from './asset-library-service.js';
import { AiAssetService } from './ai-asset-service.js';

export class DungeongenService {
    constructor(baseUrl) {
        // baseUrl is kept for backward compatibility but not used
        this.baseUrl = baseUrl;
        this.library = new AssetLibraryService();
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
     * @returns {Promise<Object>} - { blob, walls, items }
     */
    async generate(options) {
        console.log("Vibe Scenes | Generating dungeon locally with options:", options);

        try {
            // Use integrated local generation to get data
            // We use generateDungeonWithData to get the grid for item placement
            const result = await generateDungeonWithData({
                size: options.size,
                maskType: options.maskType,
                corridorStyle: options.corridorStyle,
                connectivity: options.connectivity,
                density: options.density,
                seed: options.seed,
                waterDepth: options.waterDepth,
                gridSize: options.gridSize || 20,
                deadEndRemoval: options.deadEndRemoval,
                peripheralEgress: options.peripheralEgress,
                doorDensity: options.doorDensity,
                stairs: options.stairs,
                floorTexture: options.floorTexture
            });

            // Populate rooms with items
            const items = await this._populateRooms(result.dungeon, options);

            console.log("Vibe Scenes | Dungeon generated successfully");
            return {
                blob: result.blob,
                walls: result.walls,
                items: items
            };

        } catch (error) {
            console.error("Vibe Scenes | Local generation failed:", error);
            throw new Error(`Failed to generate dungeon: ${error.message}`);
        }
    }

    /**
     * Populate larger rooms with random items
     * @param {DungeonGrid} grid 
     * @param {Object} options 
     */
    async _populateRooms(grid, options) {
        const items = [];
        const gridSize = options.gridSize || 20;

        // 1. Load Library
        await this.library.load();
        let objects = this.library.getAssets("OBJECT");

        // 2. Fallback Generation (if enabled/needed)
        // Check if we have an API key to allow generation
        const apiKey = game.settings.get("vibe-scenes", "geminiApiKey");
        if (objects.length === 0 && apiKey) {
            console.log("Vibe Scenes | No objects found, generating defaults using Gemini...");
            const model = game.settings.get("vibe-scenes", "geminiModel");
            const aiService = new AiAssetService(apiKey, model);

            const defaults = ["wooden crate", "old barrel", "stone chest", "wooden table"];

            // Notify user about generation delay
            ui.notifications.info("Generating default assets (crates, barrels)... this may take a moment.");

            for (const name of defaults) {
                try {
                    const svg = await aiService.generateSVG(name, "OBJECT");
                    const path = await aiService.saveAsset(svg, name.replace(" ", "_"), "OBJECT");
                    // Assuming saveAsset registers it, but let's ensure library is fresh
                } catch (e) {
                    console.error(`Vibe Scenes | Failed to generate ${name}:`, e);
                }
            }
            // Reload library to get new assets
            await this.library.load();
            objects = this.library.getAssets("OBJECT");
        }

        if (objects.length === 0) return items;

        // 3. AI Room Population (Targeting the Largest Room)
        if (apiKey) {
            // Find largest room
            let largestRoom = null;
            let maxArea = 0;
            for (const room of grid.rooms) {
                const area = room.width * room.height;
                if (area > maxArea) {
                    maxArea = area;
                    largestRoom = room;
                }
            }

            // Only populate if it's a significant room
            if (largestRoom && maxArea > 36) {
                console.log("Vibe Scenes | Populating largest room with AI...", largestRoom);
                const model = game.settings.get("vibe-scenes", "geminiModel");
                const aiService = new AiAssetService(apiKey, model);

                // Notify user
                ui.notifications.info("Consulting the Oracle for boss room layout...");

                // Infer type? For now, hardcode or random
                const roomTypes = ["Throne Room", "Boss Chamber", "Ancient Library", "Armory", "Mess Hall"];
                const type = roomTypes[Math.floor(this._pseudoRandom(options.seed) * roomTypes.length)];

                // Prepare available assets list (simplifying for prompt)
                const availableAssets = objects.map(o => o.id);

                const suggestions = await aiService.suggestRoomContents({
                    type: type,
                    width: largestRoom.width,
                    height: largestRoom.height
                }, availableAssets);

                console.log("Vibe Scenes | AI suggested:", suggestions);

                for (const item of suggestions) {
                    // Try to find matching asset in library
                    // 1. Check if AI used a specific ID
                    let asset = null;
                    if (item.original_id) {
                        asset = objects.find(o => o.id === item.original_id);
                    }

                    // 2. Fallback: Exact ID match on name (legacy behavior)
                    if (!asset) {
                        asset = objects.find(o => o.id.toLowerCase() === item.name.toLowerCase().replace(/ /g, "_"));
                    }

                    if (!asset) {
                        // Fuzzy search in tags or name
                        const search = item.name.toLowerCase();
                        asset = objects.find(o =>
                            o.tags?.some(t => search.includes(t)) ||
                            o.id.includes(search.replace(/ /g, "_"))
                        );
                    }

                    // Fallback: Pick a random object if we can't match (for now, to see placement)
                    // In future: Generate it!
                    if (!asset) {
                        asset = objects[Math.floor(Math.random() * objects.length)];
                    }

                    if (asset) {
                        const padding = gridSize * 2;
                        // Ensure coordinates are within bounds
                        const ix = Math.max(0, Math.min(item.x, largestRoom.width - 1));
                        const iy = Math.max(0, Math.min(item.y, largestRoom.height - 1));

                        items.push({
                            x: (largestRoom.x + ix) * gridSize + padding,
                            y: (largestRoom.y + iy) * gridSize + padding,
                            texture: asset.path,
                            width: gridSize,
                            height: gridSize,
                            rotation: item.rotation || 0
                        });
                    }
                }

                // Mark as populated so standard loop skips it
                largestRoom._populated = true;
            }
        }

        // 3. Place Items in Large Rooms
        // Define "Large" as area > 36 grid units (e.g. 6x6)
        const LARGE_ROOM_THRESHOLD = 36;
        const PADDING = 1; // Keep away from walls

        for (const room of grid.rooms) {
            if (room._populated) continue;

            const area = room.width * room.height;
            if (area >= LARGE_ROOM_THRESHOLD) {
                // Determine number of items (1-3)
                const count = 1 + Math.floor(this._pseudoRandom(options.seed + room.id) * 3);

                for (let i = 0; i < count; i++) {
                    const asset = objects[Math.floor(Math.random() * objects.length)];

                    // Random position in room (respecting walls)
                    // room.x/y are grid coordinates
                    const rx = room.x + PADDING + Math.floor(Math.random() * (room.width - PADDING * 2));
                    const ry = room.y + PADDING + Math.floor(Math.random() * (room.height - PADDING * 2));

                    // Convert to pixel coordinates for Foundry
                    // Center in cell, with padding matching the renderer
                    const padding = gridSize * 2;
                    const px = rx * gridSize + padding;
                    const py = ry * gridSize + padding;

                    items.push({
                        x: px,
                        y: py,
                        texture: asset.path,
                        width: gridSize, // Default to 1x1 grid cell size
                        height: gridSize,
                        rotation: Math.floor(Math.random() * 4) * 90 // Degrees
                    });
                }
            }
        }

        console.log(`Vibe Scenes | Placed ${items.length} items in dungeon.`);
        return items;
    }

    /**
     * Simple pseudo-random generator
     */
    _pseudoRandom(seed) {
        const x = Math.sin(typeof seed === 'string' ? seed.length : seed) * 10000;
        return x - Math.floor(x);
    }
}
