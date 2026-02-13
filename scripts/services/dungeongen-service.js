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
    * Populate rooms with items using AI planning or random fallback
    * @param {DungeonGrid} grid 
    * @param {Object} options 
    */
    async _populateRooms(grid, options) {
        const items = [];
        const gridSize = options.gridSize || 20;

        // 1. Load Library
        await this.library.load();
        let objects = this.library.getAssets("OBJECT");

        // 2. Generate Fallback Assets if Empty
        const apiKey = game.settings.get("vibe-scenes", "geminiApiKey");
        if (objects.length === 0 && apiKey) {
            console.log("Vibe Scenes | No objects found, generating defaults...");
            const model = game.settings.get("vibe-scenes", "geminiModel");
            const aiService = new AiAssetService(apiKey, model);
            const defaults = ["wooden crate", "old barrel", "stone chest", "wooden table"];

            ui.notifications.info("Generating default assets (crates, barrels)...");

            for (const name of defaults) {
                try {
                    const svg = await aiService.generateSVG(name, "OBJECT");
                    await aiService.saveAsset(svg, name.replace(" ", "_"), "OBJECT");
                } catch (e) {
                    console.error(`Vibe Scenes | Failed to generate ${name}:`, e);
                }
            }
            await this.library.load();
            objects = this.library.getAssets("OBJECT");
        }

        if (objects.length === 0) return items;

        // 3. AI Dungeon Planning
        if (apiKey) {
            console.log("Vibe Scenes | Planning dungeon layout...");
            ui.notifications.info("Consulting the Oracle for dungeon layout...");

            const model = game.settings.get("vibe-scenes", "geminiModel");
            const aiService = new AiAssetService(apiKey, model);

            // Prepare simplified asset list
            const availableAssets = objects.map(o => o.id);

            // Call the planner
            const { plan, wishlist } = await aiService.planDungeon(grid.rooms, availableAssets);
            console.log("Vibe Scenes | Dungeon Plan:", plan);
            console.log("Vibe Scenes | Asset Wishlist:", wishlist);

            // PROCESS WISHLIST
            if (wishlist && wishlist.length > 0) {
                const totalNew = wishlist.length;
                let current = 0;

                // Notify user - this takes time
                ui.notifications.info(`AI requested ${totalNew} new assets. This may take a moment...`);

                for (const item of wishlist) {
                    current++;
                    // Double check we don't have it (fuzzy match)
                    const existing = objects.find(o => o.id === item.name.replace(/ /g, "_").toLowerCase());
                    if (existing) continue;

                    // Update progress (if possible, otherwise just log)
                    console.log(`Vibe Scenes | Generating missing asset [${current}/${totalNew}]: ${item.name}`);
                    const msg = `Crafting new asset (${current}/${totalNew}): ${item.name}...`;
                    ui.notifications.info(msg);

                    try {
                        let prompt = item.name;
                        if (item.visual_style) prompt += `\nVisual Style: ${item.visual_style}`;

                        const svg = await aiService.generateSVG(prompt, "OBJECT");
                        const baseName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const fileName = `${baseName}_${Date.now().toString().slice(-6)}`;

                        await aiService.saveAsset(svg, fileName, "OBJECT", ["ai-gen", "auto-generated"]);
                    } catch (e) {
                        console.error(`Vibe Scenes | Failed to auto-generate ${item.name}:`, e);
                    }
                }

                // RELOAD LIBRARY so new assets are available for placement
                // Add a small delay to allow filesystem to settle
                await new Promise(resolve => setTimeout(resolve, 1000));

                await this.library.load();
                objects = this.library.getAssets("OBJECT");
                ui.notifications.info("New assets crafted! Arranging rooms...");
            }

            // Map plan to items
            for (const roomPlan of plan) {
                const room = grid.rooms.find(r => r.id === roomPlan.id);
                if (!room) continue;

                // Store theme on room for debug/future use
                room.theme = roomPlan.theme;

                if (roomPlan.contents) {
                    for (const item of roomPlan.contents) {
                        // Find asset
                        let asset = null;
                        if (item.original_id) {
                            asset = objects.find(o => o.id === item.original_id);
                        }
                        if (!asset) {
                            // Fuzzy search
                            const search = item.name.toLowerCase();
                            asset = objects.find(o =>
                                o.tags?.some(t => search.includes(t)) ||
                                o.id.includes(search.replace(/ /g, "_"))
                            );
                        }
                        // Fallback to random if not found (but still meaningful placement)
                        if (!asset) {
                            asset = objects[Math.floor(Math.random() * objects.length)];
                        }

                        if (asset) {
                            const padding = gridSize * 2;
                            // Ensure coordinates are within room bounds
                            const ix = Math.max(0, Math.min(item.x, room.width - 1));
                            const iy = Math.max(0, Math.min(item.y, room.height - 1));

                            items.push({
                                x: (room.x + ix) * gridSize + padding,
                                y: (room.y + iy) * gridSize + padding,
                                texture: asset.path,
                                width: gridSize,
                                height: gridSize,
                                rotation: item.rotation || 0
                            });
                            // LOGGING: Trace asset usage
                            console.log(`Vibe Scenes | Placed asset: ${asset.path} at ${items[items.length - 1].x}, ${items[items.length - 1].y}`);
                        } else {
                            console.warn(`Vibe Scenes | Failed to find asset for item:`, item);
                        }
                    }
                }
                room._populated = true;
            }
        }

        // 4. Fallback: Random Population for unpopulated rooms (or if AI failed)
        // Define "Large" as area > 36 grid units (e.g. 6x6)
        const LARGE_ROOM_THRESHOLD = 36;
        const PADDING = 1;

        for (const room of grid.rooms) {
            if (room._populated) continue;

            const area = room.width * room.height;
            if (area >= LARGE_ROOM_THRESHOLD) {
                const count = 1 + Math.floor(this._pseudoRandom(options.seed + room.id) * 3);
                for (let i = 0; i < count; i++) {
                    const asset = objects[Math.floor(Math.random() * objects.length)];
                    const rx = room.x + PADDING + Math.floor(Math.random() * (room.width - PADDING * 2));
                    const ry = room.y + PADDING + Math.floor(Math.random() * (room.height - PADDING * 2));

                    const padding = gridSize * 2;
                    items.push({
                        x: rx * gridSize + padding,
                        y: ry * gridSize + padding,
                        texture: asset.path,
                        width: gridSize,
                        height: gridSize,
                        rotation: Math.floor(Math.random() * 4) * 90
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
