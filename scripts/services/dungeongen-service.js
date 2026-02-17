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
            generationMode: options.generationMode || "procedural",
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
            const generationMode = options.generationMode || "procedural";
            const generatorOptions = {
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
            };
            console.log(`Vibe Scenes | [${runId}] Layout config`, { width, height, numRooms, generationMode, maskType: generatorOptions.maskType });

            if (options.onProgress) options.onProgress("Generating dungeon layout...", 5);

            const layoutStart = performance.now();
            let planningContext = {};
            let grid = null;
            const apiKey = game.settings.get("vibe-scenes", "geminiApiKey");
            const modelConfig = this._getModelConfig();
            if (generationMode === "intentional" && apiKey) {
                const aiService = this._createAiService(apiKey, modelConfig);
                if (options.onProgress) options.onProgress("Designing intentional dungeon outline...", 10);
                const outline = await aiService.planDungeonOutline({
                    width,
                    height,
                    targetRoomCount: numRooms,
                    shapePreference: options.maskType || "rectangle",
                    description: options.dungeonDescription
                });
                if (options.onProgress) options.onProgress("Building rooms from outline...", 18);
                planningContext = { intentionalOutline: outline };
                generatorOptions.maskType = outline?.mask_type || generatorOptions.maskType;
                const generator = new DungeonGenerator(width, height, generatorOptions);
                grid = generator.generateFromOutline(outline);
                console.log(`Vibe Scenes | [${runId}] Intentional outline layout generated`, {
                    outlineRooms: outline?.rooms?.length || 0,
                    outlineConnections: outline?.connections?.length || 0,
                    maskType: generatorOptions.maskType
                });
            } else {
                if (generationMode === "intentional" && !apiKey) {
                    console.warn(`Vibe Scenes | [${runId}] Intentional mode requested, but no Gemini API key found. Falling back to procedural layout.`);
                }
                if (options.onProgress) options.onProgress("Carving rooms and corridors...", 12);
                const generator = new DungeonGenerator(width, height, generatorOptions);
                grid = generator.generate();
            }
            console.log(`Vibe Scenes | [${runId}] Layout generated in ${(performance.now() - layoutStart).toFixed(0)}ms`, {
                rooms: grid.rooms?.length || 0
            });
            if (options.onProgress) options.onProgress(`Layout complete — ${grid.rooms?.length || 0} rooms. Planning content...`, 22);

            // 2. AI Planning & Population (Themes + Textures + Items)
            const planStart = performance.now();
            const planned = await this._planAndPopulate(grid, options, planningContext);
            let items = planned.items || [];
            let roomTextures = planned.roomTextures || {};
            let defaultTexture = planned.defaultTexture || null;
            let wallTexture = planned.wallTexture || null;
            let roomWallTextures = planned.roomWallTextures || {};
            console.log(`Vibe Scenes | [${runId}] Planning/population complete in ${(performance.now() - planStart).toFixed(0)}ms`, {
                placedItems: items?.length || 0,
                roomTextureOverrides: Object.keys(roomTextures || {}).length,
                hasDefaultTexture: Boolean(defaultTexture),
                hasWallTexture: Boolean(wallTexture),
                roomWallTextureOverrides: Object.keys(roomWallTextures || {}).length
            });

            if (options.onProgress) options.onProgress(`Rendering map with ${items?.length || 0} items...`, 80);

            // 3. Render Map
            const renderer = new DungeonRenderer(grid, {
                cellSize: options.gridSize || 20,
                drawNumbers: true,
                floorTexture: defaultTexture,
                roomTextures: roomTextures || {},
                wallTexture: wallTexture,
                roomWallTextures: roomWallTextures || {},
            });

            console.log(`Vibe Scenes | [${runId}] Rendering to blob...`);
            const renderStart = performance.now();
            let blob = await renderer.renderToBlob();
            console.log(`Vibe Scenes | [${runId}] Renderer produced blob in ${(performance.now() - renderStart).toFixed(0)}ms`, {
                bytes: blob?.size || 0
            });

            // 3b. Optional visual QA pass: let AI inspect the rendered image and propose bounded edits.
            if (apiKey && options.visualReview !== false) {
                if (options.onProgress) options.onProgress("Reviewing rendered map visuals...", 84);
                const visualPass = await this._runVisualReviewPass({
                    runId,
                    apiKey,
                    modelConfig,
                    grid,
                    options,
                    previewBlob: blob,
                    items,
                    roomTextures,
                    defaultTexture,
                    wallTexture,
                    roomWallTextures
                });

                if (visualPass?.applied) {
                    items = visualPass.items;
                    roomTextures = visualPass.roomTextures;
                    defaultTexture = visualPass.defaultTexture;
                    wallTexture = visualPass.wallTexture;
                    roomWallTextures = visualPass.roomWallTextures;

                    if (options.onProgress) options.onProgress("Applying visual adjustments and re-rendering...", 87);
                    console.log(`Vibe Scenes | [${runId}] Re-rendering after visual review`, {
                        score: visualPass.score,
                        removedItems: visualPass.removedItems,
                        floorEdits: visualPass.floorEdits,
                        wallEdits: visualPass.wallEdits
                    });
                    const reviewedRenderer = new DungeonRenderer(grid, {
                        cellSize: options.gridSize || 20,
                        drawNumbers: true,
                        floorTexture: defaultTexture,
                        roomTextures: roomTextures || {},
                        wallTexture: wallTexture,
                        roomWallTextures: roomWallTextures || {},
                    });
                    blob = await reviewedRenderer.renderToBlob();
                }
            }

            if (options.onProgress) options.onProgress("Building walls and doors...", 90);

            // 4. Build Walls
            const wallStart = performance.now();
            const pad = (options.gridSize || 20) * 2;
            const walls = WallBuilder.build(grid, options.gridSize || 20, pad);
            console.log(`Vibe Scenes | [${runId}] Walls built in ${(performance.now() - wallStart).toFixed(0)}ms`, {
                walls: walls?.length || 0
            });

            if (options.onProgress) options.onProgress(`Generation complete — ${walls?.length || 0} walls, ${items?.length || 0} items`, 95);
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
    * @param {Object} planningContext
    */
    async _planAndPopulate(grid, options, planningContext = {}) {
        const runId = options.runId || `vs-unknown-${Date.now().toString(36)}`;
        const items = [];
        const roomTextures = {};
        const roomWallTextures = {};
        let defaultTexture = null;
        let wallTexture = null;
        const gridSize = options.gridSize || 20;
        const pixelPadding = gridSize * 2;
        const intentionalOutline = planningContext.intentionalOutline || null;

        // 1. Load Library
        const libStart = performance.now();
        console.log(`Vibe Scenes | [${runId}] Loading asset library...`);
        await this.library.load();
        let objects = this.library.getAssets("OBJECT");
        let textures = this.library.getAssets("TEXTURE");
        let wallAssets = this.library.getAssets("WALL");
        console.log(`Vibe Scenes | [${runId}] Library loaded in ${(performance.now() - libStart).toFixed(0)}ms`, {
            objects: objects.length,
            textures: textures.length,
            walls: wallAssets.length
        });

        // 2. AI Dungeon Planning
        const apiKey = game.settings.get("vibe-scenes", "geminiApiKey");
        if (apiKey) {
            if (options.onProgress) options.onProgress("Consulting the Oracle for room themes...", 24);
            console.log(`Vibe Scenes | [${runId}] Planning dungeon layout with AI...`);
            const aiService = this._createAiService(apiKey);

            // Prepare simplified asset list (Objects, Textures, AND Walls) with descriptive info
            const availableAssets = [...objects, ...textures, ...wallAssets].map(o => ({
                id: String(o.id),
                name: o.name,
                type: o.type,
                tags: o.tags || [],
                width: o.width || 1,
                height: o.height || 1,
                placement: o.placement || "blocking"
            }));

            // Call the planner
            const plannerStart = performance.now();
            let plannerResult = null;
            if (options.generationMode === "intentional" && intentionalOutline?.rooms?.length) {
                if (options.onProgress) options.onProgress("Planning content from outline...", 26);
                plannerResult = await aiService.planDungeonFromOutline({
                    rooms: grid.rooms,
                    connections: intentionalOutline.connections || [],
                    maskType: intentionalOutline.mask_type || options.maskType || "rectangle",
                    defaultFloor: intentionalOutline.default_floor,
                    description: options.dungeonDescription
                }, availableAssets);
            } else {
                if (options.onProgress) options.onProgress("Planning room themes and contents...", 26);
                plannerResult = await aiService.planDungeon(grid.rooms, availableAssets, options.dungeonDescription);
            }
            const plan = plannerResult?.plan || [];
            const wishlist = plannerResult?.wishlist || [];
            const default_floor = plannerResult?.default_floor || intentionalOutline?.default_floor;
            const default_wall = plannerResult?.default_wall || intentionalOutline?.default_wall;
            const planElapsed = (performance.now() - plannerStart).toFixed(0);
            console.log(`Vibe Scenes | [${runId}] AI planner responded in ${planElapsed}ms`, {
                planRooms: plan?.length || 0,
                wishlist: wishlist?.length || 0,
                hasDefaultFloor: Boolean(default_floor),
                hasDefaultWall: Boolean(default_wall)
            });
            if (options.onProgress) {
                const wishMsg = wishlist.length > 0 ? ` — ${wishlist.length} new asset${wishlist.length > 1 ? "s" : ""} needed` : "";
                options.onProgress(`Oracle responded with ${plan.length} room plan${plan.length !== 1 ? "s" : ""}${wishMsg}`, 28);
            }

            console.log(`Vibe Scenes | [${runId}] Dungeon Plan:`, plan);
            console.log(`Vibe Scenes | [${runId}] Asset Wishlist:`, wishlist);

            // PROCESS WISHLIST (Objects AND Textures) — parallel with concurrency limit
            if (wishlist && wishlist.length > 0) {
                // Filter out items that already exist before counting
                const itemsToGenerate = [];
                for (const item of wishlist) {
                    const type = (item.type || "OBJECT").toUpperCase();
                    const searchList = type === "TEXTURE" ? textures : type === "WALL" ? wallAssets : objects;
                    const existing = searchList.find(o => o.id === item.name.replace(/ /g, "_").toLowerCase());
                    if (existing) {
                        console.log(`Vibe Scenes | [${runId}] Wishlist item already exists, skipping`, {
                            name: item.name, type, existingPath: existing.path
                        });
                    } else {
                        itemsToGenerate.push(item);
                    }
                }

                const totalNew = itemsToGenerate.length;
                if (totalNew > 0) {
                    if (options.onProgress) options.onProgress(`Generating ${totalNew} new asset${totalNew > 1 ? "s" : ""}...`, 30);
                    ui.notifications.info(`Generating ${totalNew} new asset${totalNew > 1 ? "s" : ""} — this may take a moment...`);
                    console.log(`Vibe Scenes | [${runId}] Starting parallel wishlist generation`, { totalNew, concurrency: DungeongenService.WISHLIST_CONCURRENCY });

                    let completed = 0;
                    const concurrency = DungeongenService.WISHLIST_CONCURRENCY;

                    /**
                     * Process a single wishlist item: generate SVG + save.
                     * Returns silently on failure so one bad item doesn't block the batch.
                     */
                    const processItem = async (item, index) => {
                        const type = (item.type || "OBJECT").toUpperCase();
                        const wishTrace = `${runId}-wish-${index + 1}`;
                        const itemW = Math.max(1, Math.round(Number(item.width) || 1));
                        const itemH = Math.max(1, Math.round(Number(item.height) || 1));
                        const itemPlacement = (item.placement === "ambient") ? "ambient" : "blocking";
                        try {
                            const wishlistItemStart = performance.now();
                            let prompt = item.name;
                            if (item.visual_style) prompt += `\nVisual Style: ${item.visual_style}`;
                            if (itemW > 1 || itemH > 1) {
                                prompt += `\nGrid footprint: ${itemW}x${itemH} cells. Fill the ${itemW * 512}x${itemH * 512} viewBox proportionally.`;
                            }
                            console.log(`Vibe Scenes | [${wishTrace}] Wishlist generation request`, {
                                name: item.name, type, promptLength: prompt.length,
                                dimensions: `${itemW}x${itemH}`, placement: itemPlacement
                            });

                            const svg = await aiService.generateSVG(prompt, type, {
                                width: itemW,
                                height: itemH
                            });
                            console.log(`Vibe Scenes | [${wishTrace}] Wishlist SVG received`, {
                                name: item.name, svgChars: svg?.length || 0
                            });
                            const baseName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const fileName = `${baseName}_${Date.now().toString().slice(-6)}`;

                            const filePath = await aiService.saveAsset(svg, fileName, type, ["ai-gen", "auto-generated"], {
                                prompt: item.name, model: aiService.svgModel,
                                width: itemW, height: itemH, placement: itemPlacement
                            });
                            console.log(`Vibe Scenes | [${wishTrace}] Wishlist item generated in ${(performance.now() - wishlistItemStart).toFixed(0)}ms`, {
                                name: item.name, type, filePath,
                                dimensions: `${itemW}x${itemH}`, placement: itemPlacement
                            });
                        } catch (e) {
                            console.error(`Vibe Scenes | [${wishTrace}] Failed to auto-generate ${item.name}:`, e);
                            console.warn(`Vibe Scenes | [${wishTrace}] Fallback: proceeding without this generated asset`);
                        } finally {
                            completed++;
                            const pct = 30 + Math.floor((completed / totalNew) * 40);
                            if (options.onProgress) options.onProgress(`Crafted ${completed}/${totalNew}: ${item.name}`, pct);
                        }
                    };

                    // Run with bounded concurrency (pool pattern)
                    const queue = itemsToGenerate.map((item, i) => ({ item, index: i }));
                    const workers = [];
                    for (let w = 0; w < Math.min(concurrency, queue.length); w++) {
                        workers.push((async () => {
                            while (queue.length > 0) {
                                const { item, index } = queue.shift();
                                await processItem(item, index);
                            }
                        })());
                    }
                    await Promise.all(workers);

                    console.log(`Vibe Scenes | [${runId}] Wishlist generation complete`, { generated: completed, total: totalNew });
                    if (options.onProgress) options.onProgress("Refreshing asset library...", 72);

                    // RELOAD LIBRARY (force refresh to pick up newly generated assets)
                    const reloadStart = performance.now();
                    console.log(`Vibe Scenes | [${runId}] Waiting briefly before library reload for filesystem consistency`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await this.library.reload();
                    objects = this.library.getAssets("OBJECT");
                    textures = this.library.getAssets("TEXTURE");
                    wallAssets = this.library.getAssets("WALL");
                    console.log(`Vibe Scenes | [${runId}] Library reloaded in ${(performance.now() - reloadStart).toFixed(0)}ms`, {
                        objects: objects.length, textures: textures.length, walls: wallAssets.length
                    });
                } else {
                    console.log(`Vibe Scenes | [${runId}] All wishlist assets already exist, skipping generation`);
                }
            } else {
                console.log(`Vibe Scenes | [${runId}] No wishlist assets requested by AI`);
            }

            // RESOLVE DEFAULT FLOOR TEXTURE
            if (options.onProgress) options.onProgress("Resolving floor textures...", 74);
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

            // RESOLVE DEFAULT WALL TEXTURE
            if (default_wall) {
                const tex = this._findTexture(wallAssets, default_wall);
                if (tex) {
                    wallTexture = tex.path;
                    console.log(`Vibe Scenes | [${runId}] Resolved default wall texture: "${default_wall}" → ${tex.path}`);
                } else {
                    console.warn(`Vibe Scenes | [${runId}] Could not resolve default wall texture: "${default_wall}". Available wall assets: [${wallAssets.map(t => t.name).join(', ')}]`);
                }
            } else {
                console.warn(`Vibe Scenes | [${runId}] AI did not specify a default_wall texture.`);
            }

            // MAP PLAN TO ITEMS AND TEXTURES
            if (options.onProgress) options.onProgress("Placing items in rooms...", 76);
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

                // Resolve Wall Texture (per-room override)
                if (roomPlan.wall_texture) {
                    const tex = this._findTexture(wallAssets, roomPlan.wall_texture);
                    if (tex) {
                        roomWallTextures[room.id] = tex.path;
                        console.log(`Vibe Scenes | [${runId}] Room ${room.id} wall: "${roomPlan.wall_texture}" → ${tex.path}`);
                    } else {
                        console.warn(`Vibe Scenes | [${runId}] Room ${room.id}: Could not resolve wall texture "${roomPlan.wall_texture}"`);
                    }
                }

                // Resolve Items (blocking + ambient)
                let blockingPlaced = 0;
                let ambientPlaced = 0;
                if (Array.isArray(roomPlan.contents)) {
                    for (const item of roomPlan.contents) {
                        const asset = this._resolveObjectAsset(objects, item, room.id, options.seed);

                        if (asset) {
                            // Use item dimensions from AI plan, falling back to asset library, then 1x1
                            const cellW = Math.max(1, Math.round(Number(item.width) || Number(asset.width) || 1));
                            const cellH = Math.max(1, Math.round(Number(item.height) || Number(asset.height) || 1));
                            const placement = (item.placement === "ambient" || asset.placement === "ambient") ? "ambient" : "blocking";

                            // Ensure coordinates keep the multi-cell footprint within room bounds
                            const ix = Math.max(0, Math.min(item.x, room.width - cellW));
                            const iy = Math.max(0, Math.min(item.y, room.height - cellH));

                            items.push({
                                x: (room.x + ix) * gridSize + pixelPadding,
                                y: (room.y + iy) * gridSize + pixelPadding,
                                texture: asset.path,
                                width: cellW * gridSize,
                                height: cellH * gridSize,
                                rotation: item.rotation || 0,
                                placement
                            });
                            if (placement === "ambient") ambientPlaced += 1;
                            else blockingPlaced += 1;
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
                const { blocking: minBlocking, ambient: minAmbient } = this._getDesiredRoomItemCounts(roomArea, roomPlan.theme, room);
                for (let i = blockingPlaced; i < minBlocking; i++) {
                    if (!objects.length) break;
                    const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-fill-${i}`);
                    if (!asset) break;
                    const cellW = Math.max(1, Number(asset.width) || 1);
                    const cellH = Math.max(1, Number(asset.height) || 1);
                    const point = this._pickRoomCell(room, 1, `${options.seed}-${room.id}-fill-pt-${i}`);
                    items.push({
                        x: point.x * gridSize + pixelPadding,
                        y: point.y * gridSize + pixelPadding,
                        texture: asset.path,
                        width: cellW * gridSize,
                        height: cellH * gridSize,
                        rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-rot-${i}`) * 4) * 90,
                        placement: asset.placement || "blocking"
                    });
                    blockingPlaced += 1;
                }

                // Fill ambient items along walls if AI under-populated
                for (let i = ambientPlaced; i < minAmbient; i++) {
                    if (!objects.length) break;
                    const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-amb-${i}`);
                    if (!asset) break;
                    const point = this._pickWallAdjacentCell(room, `${options.seed}-${room.id}-amb-pt-${i}`);
                    items.push({
                        x: point.x * gridSize + pixelPadding,
                        y: point.y * gridSize + pixelPadding,
                        texture: asset.path,
                        width: gridSize,
                        height: gridSize,
                        rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-amb-rot-${i}`) * 4) * 90,
                        placement: "ambient"
                    });
                    ambientPlaced += 1;
                }

                room._populated = (blockingPlaced + ambientPlaced) > 0;
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
            if (objects.length === 0) continue;
            fallbackRooms += 1;

            const area = room.width * room.height;
            const { blocking: desiredBlocking, ambient: desiredAmbient } = this._getDesiredRoomItemCounts(area, room.theme, room);

            // Place blocking items
            for (let i = 0; i < desiredBlocking; i++) {
                const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-fallback-${i}`);
                if (!asset) break;
                const cellW = Math.max(1, Number(asset.width) || 1);
                const cellH = Math.max(1, Number(asset.height) || 1);
                const point = this._pickRoomCell(room, PADDING, `${options.seed}-${room.id}-fallback-pt-${i}`);
                items.push({
                    x: point.x * gridSize + pixelPadding,
                    y: point.y * gridSize + pixelPadding,
                    texture: asset.path,
                    width: cellW * gridSize,
                    height: cellH * gridSize,
                    rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-fallback-rot-${i}`) * 4) * 90,
                    placement: asset.placement || "blocking"
                });
                fallbackItems += 1;
            }

            // Place ambient items along walls
            for (let i = 0; i < desiredAmbient; i++) {
                const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-fallback-amb-${i}`);
                if (!asset) break;
                const point = this._pickWallAdjacentCell(room, `${options.seed}-${room.id}-fallback-amb-pt-${i}`);
                items.push({
                    x: point.x * gridSize + pixelPadding,
                    y: point.y * gridSize + pixelPadding,
                    texture: asset.path,
                    width: gridSize,
                    height: gridSize,
                    rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-fallback-amb-rot-${i}`) * 4) * 90,
                    placement: "ambient"
                });
                fallbackItems += 1;
            }

            room._populated = (desiredBlocking + desiredAmbient) > 0;
        }
        if (fallbackRooms > 0) {
            console.log(`Vibe Scenes | [${runId}] Fallback population applied`, { fallbackRooms, fallbackItems });
        }

        // 5. Post-pass: Guarantee non-corridor, non-trivial rooms are never empty.
        let postPassPlaced = 0;
        if (objects.length > 0) {
            for (const room of grid.rooms) {
                const area = room.width * room.height;
                const { blocking: desiredBlocking } = this._getDesiredRoomItemCounts(area, room.theme, room);
                if (desiredBlocking <= 0) continue;

                const roomItemCount = items.filter(item => {
                    const gx = Math.floor((item.x - pixelPadding) / gridSize);
                    const gy = Math.floor((item.y - pixelPadding) / gridSize);
                    return gx >= room.x && gx < room.x + room.width && gy >= room.y && gy < room.y + room.height;
                }).length;
                if (roomItemCount > 0) continue;

                const asset = this._pickDeterministicAsset(objects, `${options.seed}-${room.id}-postpass`);
                if (!asset) continue;
                const cellW = Math.max(1, Number(asset.width) || 1);
                const cellH = Math.max(1, Number(asset.height) || 1);
                const point = this._pickRoomCell(room, 1, `${options.seed}-${room.id}-postpass-pt`);
                items.push({
                    x: point.x * gridSize + pixelPadding,
                    y: point.y * gridSize + pixelPadding,
                    texture: asset.path,
                    width: cellW * gridSize,
                    height: cellH * gridSize,
                    rotation: Math.floor(this._pseudoRandom(`${options.seed}-${room.id}-postpass-rot`) * 4) * 90,
                    placement: asset.placement || "blocking"
                });
                room._populated = true;
                postPassPlaced += 1;
            }
        }
        if (postPassPlaced > 0) {
            console.log(`Vibe Scenes | [${runId}] Post-pass placed guaranteed items`, { postPassPlaced });
        }

        console.log(`Vibe Scenes | [${runId}] Placed ${items.length} items in dungeon.`);
        return { items, roomTextures, defaultTexture, wallTexture, roomWallTextures };
    }

    _getModelConfig() {
        const legacyModel = game.settings.get("vibe-scenes", "geminiModel");
        const textModel = game.settings.get("vibe-scenes", "geminiTextModel") || legacyModel;
        const svgModel = game.settings.get("vibe-scenes", "geminiSvgModel") || textModel;
        return { text: textModel, svg: svgModel };
    }

    _createAiService(apiKey, modelConfig = null) {
        if (!apiKey) return null;
        return new AiAssetService(apiKey, modelConfig || this._getModelConfig());
    }

    async _runVisualReviewPass({
        runId,
        apiKey,
        modelConfig,
        grid,
        options,
        previewBlob,
        items,
        roomTextures,
        defaultTexture,
        wallTexture,
        roomWallTextures
    }) {
        try {
            const aiService = this._createAiService(apiKey, modelConfig);
            if (!aiService || !previewBlob) return { applied: false };

            const textures = this.library.getAssets("TEXTURE") || [];
            const wallAssets = this.library.getAssets("WALL") || [];
            const objects = this.library.getAssets("OBJECT") || [];
            if (textures.length === 0 && wallAssets.length === 0) {
                return { applied: false };
            }

            const gridSize = options.gridSize || 20;
            const pixelPadding = gridSize * 2;
            const maxRoomContext = 80;
            const maxItemContext = 180;
            const imageBase64 = await this._blobToBase64(previewBlob);
            const roomList = Array.isArray(grid?.rooms) ? grid.rooms : [];
            const roomSummaries = roomList.slice(0, maxRoomContext).map(room => ({
                id: String(room.id),
                width: room.width,
                height: room.height,
                theme: room.theme || "",
                description: room.description || "",
                floor_texture: this._assetLabelFromPath(textures, roomTextures?.[room.id]),
                wall_texture: this._assetLabelFromPath(wallAssets, roomWallTextures?.[room.id])
            }));
            const itemSummaries = (items || []).slice(0, maxItemContext).map((item, index) => ({
                index,
                placement: item.placement || "blocking",
                x: Math.floor((Number(item.x) - pixelPadding) / gridSize),
                y: Math.floor((Number(item.y) - pixelPadding) / gridSize),
                width_cells: Math.max(1, Math.round((Number(item.width) || gridSize) / gridSize)),
                height_cells: Math.max(1, Math.round((Number(item.height) || gridSize) / gridSize)),
                texture: this._assetLabelFromPath(objects, item.texture)
            }));
            const metadata = {
                map: {
                    width: grid.width,
                    height: grid.height,
                    room_count: roomList.length,
                    item_count: items?.length || 0,
                    generation_mode: options.generationMode || "procedural",
                    dungeon_description: String(options.dungeonDescription || "")
                },
                current: {
                    default_floor: this._assetLabelFromPath(textures, defaultTexture),
                    default_wall: this._assetLabelFromPath(wallAssets, wallTexture),
                    room_floor_overrides_count: Object.keys(roomTextures || {}).length,
                    room_wall_overrides_count: Object.keys(roomWallTextures || {}).length
                },
                context_limits: {
                    rooms_included: roomSummaries.length,
                    items_included: itemSummaries.length,
                    total_rooms: roomList.length,
                    total_items: items?.length || 0
                },
                rooms: roomSummaries,
                items: itemSummaries,
                available_floor_textures: textures.slice(0, 120).map(tex => ({
                    name: tex.name,
                    tags: tex.tags || []
                })),
                available_wall_textures: wallAssets.slice(0, 120).map(tex => ({
                    name: tex.name,
                    tags: tex.tags || []
                }))
            };

            const review = await aiService.reviewRenderedMap({ imageBase64, metadata });
            const suggested = review?.changes || {};
            const hasDefaultFloorField = Object.prototype.hasOwnProperty.call(suggested, "default_floor");
            const hasDefaultWallField = Object.prototype.hasOwnProperty.call(suggested, "default_wall");
            const hasSuggestions =
                hasDefaultFloorField ||
                hasDefaultWallField ||
                (Array.isArray(suggested.room_floor) && suggested.room_floor.length > 0) ||
                (Array.isArray(suggested.room_wall) && suggested.room_wall.length > 0) ||
                (Array.isArray(suggested.remove_item_indices) && suggested.remove_item_indices.length > 0);
            if (!hasSuggestions) {
                console.log(`Vibe Scenes | [${runId}] Visual review made no actionable suggestions`, {
                    score: review?.score || 0
                });
                return { applied: false, score: review?.score || 0 };
            }

            let nextDefaultTexture = defaultTexture || null;
            let nextWallTexture = wallTexture || null;
            const nextRoomTextures = { ...(roomTextures || {}) };
            const nextRoomWallTextures = { ...(roomWallTextures || {}) };
            const nextItems = Array.isArray(items) ? [...items] : [];
            let floorEdits = 0;
            let wallEdits = 0;

            if (hasDefaultFloorField) {
                if (suggested.default_floor === null && nextDefaultTexture) {
                    nextDefaultTexture = null;
                    floorEdits += 1;
                } else {
                    const applyDefaultFloor = this._findTexture(textures, suggested.default_floor);
                    if (applyDefaultFloor && applyDefaultFloor.path !== nextDefaultTexture) {
                        nextDefaultTexture = applyDefaultFloor.path;
                        floorEdits += 1;
                    }
                }
            }

            if (hasDefaultWallField) {
                if (suggested.default_wall === null && nextWallTexture) {
                    nextWallTexture = null;
                    wallEdits += 1;
                } else {
                    const applyDefaultWall = this._findTexture(wallAssets, suggested.default_wall);
                    if (applyDefaultWall && applyDefaultWall.path !== nextWallTexture) {
                        nextWallTexture = applyDefaultWall.path;
                        wallEdits += 1;
                    }
                }
            }

            const validRoomIds = new Set((grid.rooms || []).map(room => String(room.id)));
            if (Array.isArray(suggested.room_floor)) {
                for (const edit of suggested.room_floor) {
                    const roomId = String(edit?.room_id || "").trim();
                    if (!roomId || !validRoomIds.has(roomId)) continue;
                    if (edit.texture === null) {
                        if (Object.prototype.hasOwnProperty.call(nextRoomTextures, roomId)) {
                            delete nextRoomTextures[roomId];
                            floorEdits += 1;
                        }
                        continue;
                    }
                    const match = this._findTexture(textures, edit.texture);
                    if (match && nextRoomTextures[roomId] !== match.path) {
                        nextRoomTextures[roomId] = match.path;
                        floorEdits += 1;
                    }
                }
            }

            if (Array.isArray(suggested.room_wall)) {
                for (const edit of suggested.room_wall) {
                    const roomId = String(edit?.room_id || "").trim();
                    if (!roomId || !validRoomIds.has(roomId)) continue;
                    if (edit.texture === null) {
                        if (Object.prototype.hasOwnProperty.call(nextRoomWallTextures, roomId)) {
                            delete nextRoomWallTextures[roomId];
                            wallEdits += 1;
                        }
                        continue;
                    }
                    const match = this._findTexture(wallAssets, edit.texture);
                    if (match && nextRoomWallTextures[roomId] !== match.path) {
                        nextRoomWallTextures[roomId] = match.path;
                        wallEdits += 1;
                    }
                }
            }

            let removedItems = 0;
            const removeIndices = Array.isArray(suggested.remove_item_indices)
                ? [...new Set(suggested.remove_item_indices
                    .map(v => Number(v))
                    .filter(v => Number.isInteger(v) && v >= 0)
                  )].sort((a, b) => b - a)
                : [];
            for (const idx of removeIndices) {
                if (idx >= nextItems.length) continue;
                nextItems.splice(idx, 1);
                removedItems += 1;
            }

            const applied = floorEdits > 0 || wallEdits > 0 || removedItems > 0;
            if (!applied) {
                return { applied: false, score: review?.score || 0 };
            }

            console.log(`Vibe Scenes | [${runId}] Visual review adjustments applied`, {
                score: review?.score || 0,
                needsChanges: review?.needs_changes || false,
                reasoning: review?.reasoning || "",
                floorEdits,
                wallEdits,
                removedItems
            });

            return {
                applied: true,
                score: review?.score || 0,
                floorEdits,
                wallEdits,
                removedItems,
                items: nextItems,
                roomTextures: nextRoomTextures,
                defaultTexture: nextDefaultTexture,
                wallTexture: nextWallTexture,
                roomWallTextures: nextRoomWallTextures
            };
        } catch (error) {
            console.warn(`Vibe Scenes | [${runId}] Visual review pass failed; keeping first render`, {
                message: error?.message || String(error)
            });
            return { applied: false };
        }
    }

    async _blobToBase64(blob) {
        if (!blob) return "";
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    _assetLabelFromPath(assets, path) {
        if (!path) return null;
        const normalizedPath = String(path).replace(/\\/g, "/").toLowerCase();
        const normalizedAssetPath = value => String(value || "").replace(/\\/g, "/").toLowerCase();

        let match = (assets || []).find(asset => normalizedAssetPath(asset.path) === normalizedPath);
        if (!match) {
            match = (assets || []).find(asset => {
                const candidate = normalizedAssetPath(asset.path);
                return candidate && normalizedPath.endsWith(candidate);
            });
        }
        if (match) return match.name || match.id;

        const fileName = normalizedPath.split("/").pop() || normalizedPath;
        return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").trim() || normalizedPath;
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

    /**
     * Pick a cell along the wall perimeter of a room (for ambient items).
     * Cycles through the four walls deterministically based on seed.
     */
    _pickWallAdjacentCell(room, seedToken) {
        const rng = this._pseudoRandom(seedToken);
        const perimeter = [];

        // Top wall (y = 0)
        for (let x = 0; x < room.width; x++) perimeter.push({ x: room.x + x, y: room.y });
        // Bottom wall (y = height-1)
        for (let x = 0; x < room.width; x++) perimeter.push({ x: room.x + x, y: room.y + room.height - 1 });
        // Left wall (y = 1..height-2)
        for (let y = 1; y < room.height - 1; y++) perimeter.push({ x: room.x, y: room.y + y });
        // Right wall (y = 1..height-2)
        for (let y = 1; y < room.height - 1; y++) perimeter.push({ x: room.x + room.width - 1, y: room.y + y });

        if (perimeter.length === 0) {
            return { x: room.x, y: room.y };
        }
        const idx = Math.floor(rng * perimeter.length);
        return perimeter[Math.max(0, Math.min(idx, perimeter.length - 1))];
    }

    _isLikelyCorridor(room, theme = '') {
        const normalizedTheme = String(theme || '').toLowerCase();
        if (normalizedTheme.includes('corridor') || normalizedTheme.includes('hallway') || normalizedTheme.includes('passage')) {
            return true;
        }
        return room.width <= 3 || room.height <= 3;
    }

    /**
     * Returns desired item counts split by blocking and ambient.
     * @returns {{ blocking: number, ambient: number }}
     */
    _getDesiredRoomItemCounts(area, theme = '', room = null) {
        const isCorridor = room && this._isLikelyCorridor(room, theme);
        const normalizedTheme = String(theme || '').toLowerCase();
        const isDense = normalizedTheme.includes('storage') || normalizedTheme.includes('warehouse') ||
            normalizedTheme.includes('armory') || normalizedTheme.includes('library') ||
            normalizedTheme.includes('barracks') || normalizedTheme.includes('throne');

        // Blocking items
        let blocking = 0;
        if (!isCorridor && area >= 12) {
            if (area < 36) blocking = 1;
            else if (area < 64) blocking = 2;
            else blocking = 3;
            if (isDense) blocking += 1;
            blocking = Math.max(1, Math.min(blocking, 8));
        }

        // Ambient items (always place some — even in corridors and small rooms)
        let ambient;
        if (area < 12) ambient = 1;
        else if (area < 36) ambient = 2;
        else if (area < 64) ambient = 3;
        else ambient = 4;
        if (isCorridor) {
            blocking = 0;
            ambient = Math.min(ambient, 2);
        }
        if (isDense) ambient += 1;

        return { blocking, ambient };
    }

    /**
     * @deprecated Use _getDesiredRoomItemCounts instead
     */
    _getDesiredRoomItemCount(area, theme = '', room = null) {
        const { blocking, ambient } = this._getDesiredRoomItemCounts(area, theme, room);
        return blocking + ambient;
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

/**
 * Maximum number of wishlist SVG generations to run in parallel.
 * Each generation can trigger up to 6 Gemini API calls (3 passes × [SVG + critique]).
 * Paid Tier 1 allows 150-300 RPM, so 2 concurrent items is safe.
 * Free tier (5-10 RPM) relies on the retry/backoff in GeminiService.
 */
DungeongenService.WISHLIST_CONCURRENCY = 2;
