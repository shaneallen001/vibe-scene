/**
 * Dungeongen Service
 * 
 * Generates dungeon maps locally using the integrated dungeongen library.
 * No external API dependency required.
 */


import { DungeonGenerator, DungeonRenderer } from '../dungeongen/dungeongen.js';
import { WallBuilder } from '../dungeongen/map/wall-builder.js';
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
     * @returns {Promise<Object>} - { blob, walls, items }
     */
    async generate(options) {
        const runId = options.runId || `vs-unknown-${Date.now().toString(36)}`;
        console.groupCollapsed(`Vibe Scenes | [${runId}] DungeongenService.generate`);
        console.log(`Vibe Scenes | [${runId}] Generating dungeon locally with options:`, {
            size: options.size,
            maskType: options.maskType,
            symmetry: options.symmetry,
            corridorStyle: options.corridorStyle,
            connectivity: options.connectivity,
            density: options.density,
            seed: options.seed,
            gridSize: options.gridSize,
            deadEndRemoval: options.deadEndRemoval,
            peripheralEgress: options.peripheralEgress,
            doorDensity: options.doorDensity,
            hasDescription: Boolean(options.dungeonDescription?.trim())
        });
        const startTime = performance.now();

        try {
            // 1. Generate Layout (Grid)
            // We duplicate the config logic from dungeongen.js here or just pass options
            const width = options.size === 'tiny' ? 40 : options.size === 'small' ? 60 : options.size === 'large' ? 120 : options.size === 'xlarge' ? 160 : 90;
            const height = width;
            const numRooms = options.size === 'tiny' ? 5 : options.size === 'small' ? 10 : options.size === 'large' ? 35 : options.size === 'xlarge' ? 50 : 20;
            console.log(`Vibe Scenes | [${runId}] Layout config`, { width, height, numRooms });

            const generator = new DungeonGenerator(width, height, {
                numRooms,
                minRoomSize: options.size === 'tiny' ? 5 : 8,
                maxRoomSize: options.size === 'tiny' ? 10 : 15,
                maskType: options.maskType || 'rectangle',
                density: options.density,
                corridorStyle: options.corridorStyle,
                connectivity: options.connectivity,
                deadEndRemoval: options.deadEndRemoval,
                peripheralEgress: options.peripheralEgress,
                doorDensity: options.doorDensity
            });

            const layoutStart = performance.now();
            const grid = generator.generate();
            console.log(`Vibe Scenes | [${runId}] Layout generated in ${(performance.now() - layoutStart).toFixed(0)}ms`, {
                rooms: grid.rooms?.length || 0
            });

            if (options.onProgress) options.onProgress("Consulting the Oracle...", 30);

            // 2. AI Planning & Population (Themes + Textures + Items)
            const planStart = performance.now();
            const { items, roomTextures, defaultTexture } = await this._planAndPopulate(grid, options);
            console.log(`Vibe Scenes | [${runId}] Planning/population complete in ${(performance.now() - planStart).toFixed(0)}ms`, {
                placedItems: items?.length || 0,
                roomTextureOverrides: Object.keys(roomTextures || {}).length,
                hasDefaultTexture: Boolean(defaultTexture)
            });

            if (options.onProgress) options.onProgress("Rendering map...", 80);

            // 3. Render Map
            // Use the determined default texture or fallback
            // Use roomTextures for specific rooms
            const renderer = new DungeonRenderer(grid, {
                cellSize: options.gridSize || 20,
                drawNumbers: true, // Maybe make this configurable?
                floorTexture: defaultTexture,
                roomTextures: roomTextures || {},
                // ... color options ...
            });

            console.log(`Vibe Scenes | [${runId}] Rendering to blob...`);
            const renderStart = performance.now();
            const blob = await renderer.renderToBlob();
            console.log(`Vibe Scenes | [${runId}] Renderer produced blob in ${(performance.now() - renderStart).toFixed(0)}ms`, {
                bytes: blob?.size || 0
            });

            // 4. Build Walls
            const wallStart = performance.now();
            const pad = (options.gridSize || 20) * 2;
            const walls = WallBuilder.build(grid, options.gridSize || 20, pad);
            console.log(`Vibe Scenes | [${runId}] Walls built in ${(performance.now() - wallStart).toFixed(0)}ms`, {
                walls: walls?.length || 0
            });

            console.log(`Vibe Scenes | [${runId}] Generation complete in ${(performance.now() - startTime).toFixed(0)}ms`);

            return {
                blob,
                walls,
                items,
                rooms: grid.rooms
            };

        } catch (error) {
            console.error(`Vibe Scenes | [${runId}] Generation failed:`, error);
            throw new Error(`Failed to generate dungeon: ${error.message}`);
        } finally {
            console.groupEnd();
        }
    }



    /**
    * Plan and populate the dungeon with items and textures
    * @param {DungeonGrid} grid 
    * @param {Object} options 
    */
    async _planAndPopulate(grid, options) {
        const runId = options.runId || `vs-unknown-${Date.now().toString(36)}`;
        const items = [];
        const roomTextures = {};
        let defaultTexture = null;
        const gridSize = options.gridSize || 20;
        const pixelPadding = gridSize * 2;

        // 1. Load Library
        const libStart = performance.now();
        console.log(`Vibe Scenes | [${runId}] Loading asset library...`);
        await this.library.load();
        let objects = this.library.getAssets("OBJECT");
        let textures = this.library.getAssets("TEXTURE"); // Load textures too
        console.log(`Vibe Scenes | [${runId}] Library loaded in ${(performance.now() - libStart).toFixed(0)}ms`, {
            objects: objects.length,
            textures: textures.length
        });

        // 2. AI Dungeon Planning
        const apiKey = game.settings.get("vibe-scenes", "geminiApiKey");
        if (apiKey) {
            console.log(`Vibe Scenes | [${runId}] Planning dungeon layout with AI...`);
            const legacyModel = game.settings.get("vibe-scenes", "geminiModel");
            const textModel = game.settings.get("vibe-scenes", "geminiTextModel") || legacyModel;
            const svgModel = game.settings.get("vibe-scenes", "geminiSvgModel") || textModel;
            const aiService = new AiAssetService(apiKey, { text: textModel, svg: svgModel });

            // Prepare simplified asset list (Objects AND Textures) with descriptive info
            const availableAssets = [...objects, ...textures].map(o => ({
                id: String(o.id), // Stable numeric library ID as string for JSON-safe matching
                name: o.name,
                type: o.type,
                tags: o.tags || []
            }));

            // Call the planner
            const plannerStart = performance.now();
            const { plan, wishlist, default_floor } = await aiService.planDungeon(grid.rooms, availableAssets, options.dungeonDescription);
            console.log(`Vibe Scenes | [${runId}] AI planner responded in ${(performance.now() - plannerStart).toFixed(0)}ms`, {
                planRooms: plan?.length || 0,
                wishlist: wishlist?.length || 0,
                hasDefaultFloor: Boolean(default_floor)
            });

            console.log(`Vibe Scenes | [${runId}] Dungeon Plan:`, plan);
            console.log(`Vibe Scenes | [${runId}] Asset Wishlist:`, wishlist);

            // PROCESS WISHLIST (Objects AND Textures)
            if (wishlist && wishlist.length > 0) {
                const totalNew = wishlist.length;
                let current = 0;
                ui.notifications.info(`AI requested ${totalNew} new assets. This may take a moment...`);
                console.log(`Vibe Scenes | [${runId}] Starting wishlist generation`, { totalNew });

                for (const item of wishlist) {
                    current++;
                    const type = (item.type || "OBJECT").toUpperCase();
                    const wishTrace = `${runId}-wish-${current}`;

                    // Double check (fuzzy match)
                    const searchList = type === "TEXTURE" ? textures : objects;
                    const existing = searchList.find(o => o.id === item.name.replace(/ /g, "_").toLowerCase());
                    if (existing) {
                        console.log(`Vibe Scenes | [${wishTrace}] Wishlist item already exists, skipping`, {
                            name: item.name,
                            type,
                            existingPath: existing.path
                        });
                        continue;
                    }

                    const msg = `Crafting ${item.name}...`;
                    if (options.onProgress) options.onProgress(msg, 30 + Math.floor((current / totalNew) * 40));

                    try {
                        const wishlistItemStart = performance.now();
                        let prompt = item.name;
                        if (item.visual_style) prompt += `\nVisual Style: ${item.visual_style}`;
                        console.log(`Vibe Scenes | [${wishTrace}] Wishlist generation request`, {
                            name: item.name,
                            type,
                            promptLength: prompt.length
                        });

                        const svg = await aiService.generateSVG(prompt, type);
                        console.log(`Vibe Scenes | [${wishTrace}] Wishlist SVG received`, {
                            name: item.name,
                            svgChars: svg?.length || 0
                        });
                        const baseName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const fileName = `${baseName}_${Date.now().toString().slice(-6)}`;

                        const filePath = await aiService.saveAsset(svg, fileName, type, ["ai-gen", "auto-generated"], {
                            prompt: item.name,
                            model: aiService.svgModel
                        });
                        console.log(`Vibe Scenes | [${wishTrace}] Wishlist item generated in ${(performance.now() - wishlistItemStart).toFixed(0)}ms`, {
                            name: item.name,
                            type,
                            filePath
                        });
                    } catch (e) {
                        console.error(`Vibe Scenes | [${wishTrace}] Failed to auto-generate ${item.name}:`, e);
                        console.warn(`Vibe Scenes | [${wishTrace}] Fallback: proceeding without this generated asset`);
                    }
                }

                // RELOAD LIBRARY (force refresh to pick up newly generated assets)
                const reloadStart = performance.now();
                console.log(`Vibe Scenes | [${runId}] Waiting briefly before library reload for filesystem consistency`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.library.reload();
                objects = this.library.getAssets("OBJECT");
                textures = this.library.getAssets("TEXTURE");
                console.log(`Vibe Scenes | [${runId}] Library reloaded in ${(performance.now() - reloadStart).toFixed(0)}ms`, {
                    objects: objects.length,
                    textures: textures.length
                });
            } else {
                console.log(`Vibe Scenes | [${runId}] No wishlist assets requested by AI`);
            }

            // RESOLVE DEFAULT TEXTURE
            if (default_floor) {
                const tex = this._findTexture(textures, default_floor);
                if (tex) {
                    defaultTexture = tex.path;
                    console.log(`Vibe Scenes | [${runId}] Resolved default floor texture: "${default_floor}" → ${tex.path}`);
                } else {
                    console.warn(`Vibe Scenes | [${runId}] Could not resolve default floor texture: "${default_floor}". Available textures: [${textures.map(t => t.name).join(', ')}]`);
                }
            } else {
                console.warn(`Vibe Scenes | [${runId}] AI did not specify a default_floor texture.`);
            }

            // MAP PLAN TO ITEMS AND TEXTURES
            for (const roomPlan of plan) {
                const room = grid.rooms.find(r => r.id === roomPlan.id);
                if (!room) {
                    console.warn(`Vibe Scenes | [${runId}] Plan entry references missing room`, { roomId: roomPlan.id });
                    continue;
                }
                const roomArea = room.width * room.height;
                let itemsPlaced = 0;

                // Store theme
                room.theme = roomPlan.theme;
                room.description = roomPlan.description;

                // Resolve Floor Texture
                if (roomPlan.floor_texture) {
                    const tex = this._findTexture(textures, roomPlan.floor_texture);
                    if (tex) {
                        roomTextures[room.id] = tex.path;
                        console.log(`Vibe Scenes | [${runId}] Room ${room.id} floor: "${roomPlan.floor_texture}" → ${tex.path}`);
                    } else {
                        console.warn(`Vibe Scenes | [${runId}] Room ${room.id}: Could not resolve floor texture "${roomPlan.floor_texture}"`);
                    }
                }

                // Resolve Items
                if (Array.isArray(roomPlan.contents)) {
                    for (const item of roomPlan.contents) {
                        const asset = this._resolveObjectAsset(objects, item, room.id, options.seed);

                        if (asset) {
                            // Ensure coordinates are within room bounds
                            const ix = Math.max(0, Math.min(item.x, room.width - 1));
                            const iy = Math.max(0, Math.min(item.y, room.height - 1));

                            items.push({
                                x: (room.x + ix) * gridSize + pixelPadding,
                                y: (room.y + iy) * gridSize + pixelPadding,
                                texture: asset.path,
                                width: gridSize,
                                height: gridSize,
                                rotation: item.rotation || 0
                            });
                            itemsPlaced += 1;
                        } else {
                            console.warn(`Vibe Scenes | [${runId}] Could not resolve room content item`, {
                                roomId: room.id,
                                itemName: item?.name,
                                originalId: item?.original_id
                            });
                        }
                    }
                }

                // Ensure thematic minimum density even if AI under-populates the room.
                const minDesired = this._getDesiredRoomItemCount(roomArea, roomPlan.theme, room);
                for (let i = itemsPlaced; i < minDesired; i++) {
                    if (!objects.length) break;
                    const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-fill-${i}`);
                    if (!asset) break;
                    const point = this._pickRoomCell(room, 1, `${options.seed}-${room.id}-fill-pt-${i}`);
                    items.push({
                        x: point.x * gridSize + pixelPadding,
                        y: point.y * gridSize + pixelPadding,
                        texture: asset.path,
                        width: gridSize,
                        height: gridSize,
                        rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-rot-${i}`) * 4) * 90
                    });
                    itemsPlaced += 1;
                }

                room._populated = itemsPlaced > 0;
            }
        } else {
            console.warn(`Vibe Scenes | [${runId}] No Gemini API key configured. Falling back to deterministic non-AI room population.`);
        }

        // 4. Fallback: Populate rooms that AI did not populate.
        const PADDING = 1;
        let fallbackRooms = 0;
        let fallbackItems = 0;

        for (const room of grid.rooms) {
            if (room._populated) continue;
            // Only populate if we have objects
            if (objects.length === 0) continue;
            fallbackRooms += 1;

            const area = room.width * room.height;
            const desired = this._getDesiredRoomItemCount(area, room.theme, room);
            for (let i = 0; i < desired; i++) {
                const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-fallback-${i}`);
                if (!asset) break;
                const point = this._pickRoomCell(room, PADDING, `${options.seed}-${room.id}-fallback-pt-${i}`);
                items.push({
                    x: point.x * gridSize + pixelPadding,
                    y: point.y * gridSize + pixelPadding,
                    texture: asset.path,
                    width: gridSize,
                    height: gridSize,
                    rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-fallback-rot-${i}`) * 4) * 90
                });
                fallbackItems += 1;
            }
            room._populated = desired > 0;
        }
        if (fallbackRooms > 0) {
            console.log(`Vibe Scenes | [${runId}] Fallback population applied`, { fallbackRooms, fallbackItems });
        }

        // 5. Post-pass: Guarantee non-corridor, non-trivial rooms are never empty.
        let postPassPlaced = 0;
        if (objects.length > 0) {
            for (const room of grid.rooms) {
                const area = room.width * room.height;
                const desired = this._getDesiredRoomItemCount(area, room.theme, room);
                if (desired <= 0) continue;

                const roomItemCount = items.filter(item => {
                    const gx = Math.floor((item.x - pixelPadding) / gridSize);
                    const gy = Math.floor((item.y - pixelPadding) / gridSize);
                    return gx >= room.x && gx < room.x + room.width && gy >= room.y && gy < room.y + room.height;
                }).length;
                if (roomItemCount > 0) continue;

                const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-postpass`);
                if (!asset) continue;
                const point = this._pickRoomCell(room, 1, `${options.seed}-${room.id}-postpass-pt`);
                items.push({
                    x: point.x * gridSize + pixelPadding,
                    y: point.y * gridSize + pixelPadding,
                    texture: asset.path,
                    width: gridSize,
                    height: gridSize,
                    rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-postpass-rot`) * 4) * 90
                });
                room._populated = true;
                postPassPlaced += 1;
            }
        }
        if (postPassPlaced > 0) {
            console.log(`Vibe Scenes | [${runId}] Post-pass placed guaranteed items`, { postPassPlaced });
        }

        console.log(`Vibe Scenes | [${runId}] Placed ${items.length} items in dungeon.`);
        return { items, roomTextures, defaultTexture };
    }

    _resolveObjectAsset(objects, item, roomId, seed) {
        if (!objects.length || !item) return null;
        const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

        // 1) Stable ID first (preferred contract)
        if (item.original_id !== null && item.original_id !== undefined && item.original_id !== '') {
            const idToken = String(item.original_id);
            let match = objects.find(o => String(o.id) === idToken);
            if (match) return match;
            const normalizedIdToken = normalize(idToken);
            match = objects.find(o => normalize(o.name) === normalizedIdToken);
            if (match) return match;
        }

        const itemName = String(item.name || '').trim();
        if (itemName) {
            const normalizedName = normalize(itemName);

            // 2) Exact normalized name match
            let match = objects.find(o => normalize(o.name) === normalizedName);
            if (match) return match;

            // 3) Keyword and substring scoring against names + tags
            const words = normalizedName.split('_').filter(w => w.length > 2);
            let bestScore = 0;
            let bestMatch = null;
            for (const candidate of objects) {
                const candidateName = normalize(candidate.name);
                const candidateTags = (candidate.tags || []).map(normalize);
                const bag = [candidateName, ...candidateTags];
                let score = 0;
                for (const word of words) {
                    if (bag.some(token => token.includes(word) || word.includes(token))) score += 1;
                }
                if (candidateName.includes(normalizedName) || normalizedName.includes(candidateName)) score += 1;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = candidate;
                }
            }
            if (bestScore > 0 && bestMatch) return bestMatch;
        }

        // 4) Deterministic fallback to ensure room does not stay empty
        return this._pickDeterministicAsset(objects, `${seed}-${roomId}-${itemName || 'item'}`);
    }

    _pickDeterministicAsset(assets, seedToken) {
        if (!assets || assets.length === 0) return null;
        const idx = Math.floor(this._pseudoRandom(seedToken) * assets.length);
        return assets[Math.max(0, Math.min(idx, assets.length - 1))];
    }

    _pickRoomCell(room, padding, seedToken) {
        const safePadding = Math.max(0, padding || 0);
        const maxInnerW = Math.max(1, room.width - safePadding * 2);
        const maxInnerH = Math.max(1, room.height - safePadding * 2);
        const localX = safePadding + Math.floor(this._pseudoRandom(`${seedToken}-x`) * maxInnerW);
        const localY = safePadding + Math.floor(this._pseudoRandom(`${seedToken}-y`) * maxInnerH);
        return {
            x: Math.max(room.x, Math.min(room.x + room.width - 1, room.x + localX)),
            y: Math.max(room.y, Math.min(room.y + room.height - 1, room.y + localY))
        };
    }

    _isLikelyCorridor(room, theme = '') {
        const normalizedTheme = String(theme || '').toLowerCase();
        if (normalizedTheme.includes('corridor') || normalizedTheme.includes('hallway') || normalizedTheme.includes('passage')) {
            return true;
        }
        return room.width <= 3 || room.height <= 3;
    }

    _getDesiredRoomItemCount(area, theme = '', room = null) {
        if (area < 12) return 0;
        if (room && this._isLikelyCorridor(room, theme)) return 0;

        let count = Math.max(1, Math.floor(area / 24));
        const normalizedTheme = String(theme || '').toLowerCase();
        if (normalizedTheme.includes('storage') || normalizedTheme.includes('warehouse') || normalizedTheme.includes('armory')) count += 1;
        if (normalizedTheme.includes('library') || normalizedTheme.includes('barracks') || normalizedTheme.includes('throne')) count += 1;
        return Math.max(1, Math.min(count, 8));
    }

    /**
     * Find the best matching texture from the library using multi-strategy matching.
     * Tries: exact name match, substring match, keyword overlap match.
     * @param {Array} textures - Array of texture assets from the library
     * @param {string} query - The AI-returned texture identifier (name or description)
     * @returns {Object|null} - The matched texture asset, or null
     */
    _findTexture(textures, query) {
        if (!query || textures.length === 0) return null;

        const q = query.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Strategy 1: Exact name match
        let match = textures.find(t => t.name === q || t.name === query);
        if (match) return match;

        // Strategy 2: Name contains query or query contains name
        match = textures.find(t =>
            t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase())
        );
        if (match) return match;

        // Strategy 3: Keyword overlap (split both into words, find best overlap)
        const queryWords = q.split('_').filter(w => w.length > 2);
        let bestScore = 0;
        let bestMatch = null;
        for (const tex of textures) {
            const nameWords = tex.name.toLowerCase().split('_').filter(w => w.length > 2);
            const tagWords = (tex.tags || []).map(t => t.toLowerCase());
            const allWords = [...nameWords, ...tagWords];
            const score = queryWords.filter(w => allWords.some(nw => nw.includes(w) || w.includes(nw))).length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = tex;
            }
        }
        // Require at least 1 keyword match
        if (bestScore >= 1) return bestMatch;

        return null;
    }

    /**
     * Simple pseudo-random generator
     */
    _pseudoRandom(seed) {
        let numericSeed = seed;
        if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            numericSeed = hash;
        }
        const x = Math.sin(Number.isFinite(numericSeed) ? numericSeed : 0) * 10000;
        return x - Math.floor(x);
    }
}
