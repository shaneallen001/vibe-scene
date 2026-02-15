/**
 * Scene Importer
 * Handles creating Foundry scenes from dungeon images
 */

export class SceneImporter {
    /**
     * Create a new scene from a dungeon image
     * @param {Object} options - Scene creation options
     * @param {string} options.name - Scene name
     * @param {Blob} options.imageData - PNG image blob
     * @param {Array} options.walls - Array of wall data objects
     * @param {Array} options.items - Array of item/tile data objects
     * @param {Array} options.rooms - Array of room data objects (for journals)
     * @param {number} options.gridSize - Grid size in pixels
     * @param {number} options.seed - Seed used for generation (for metadata)
     * @returns {Promise<Scene>} - Created scene document
     */
    async createScene(options) {
        const { name, imageData, walls, items, rooms, gridSize, seed } = options;
        const runId = options.runId || `vs-${seed || "unknown"}-${Date.now().toString(36)}`;
        const startTime = performance.now();
        console.groupCollapsed(`Vibe Scenes | [${runId}] SceneImporter.createScene`);
        console.log(`Vibe Scenes | [${runId}] Scene import request`, {
            name,
            seed,
            gridSize,
            imageBytes: imageData?.size || 0,
            walls: walls?.length || 0,
            items: items?.length || 0,
            rooms: rooms?.length || 0
        });

        try {
            // Get storage path from settings
            const storagePath = game.settings.get("vibe-scenes", "imageStorage") || "vibe-scenes/dungeons";
            console.log(`Vibe Scenes | [${runId}] Storage path resolved`, { storagePath });

            // Ensure the directory exists
            const ensurePathStart = performance.now();
            await this._ensureDirectory(storagePath);
            console.log(`Vibe Scenes | [${runId}] Storage path verified in ${(performance.now() - ensurePathStart).toFixed(0)}ms`);

            // Generate filename
            const timestamp = Date.now();
            const filename = `dungeon_${seed}_${timestamp}.png`;

            // Upload the image
            if (options.onProgress) options.onProgress("Uploading dungeon map...", 10);
            const file = new File([imageData], filename, { type: 'image/png' });
            const uploadStart = performance.now();
            const uploadResult = await this._uploadFile(file, storagePath);
            console.log(`Vibe Scenes | [${runId}] Upload finished in ${(performance.now() - uploadStart).toFixed(0)}ms`, uploadResult);

            if (!uploadResult) {
                throw new Error("Failed to upload dungeon image");
            }

            // Get image dimensions
            const dimStart = performance.now();
            const dimensions = await this._getImageDimensions(imageData);
            console.log(`Vibe Scenes | [${runId}] Image dimensions read in ${(performance.now() - dimStart).toFixed(0)}ms`, dimensions);

            // Calculate scene dimensions based on grid size
            const sceneWidth = dimensions.width;
            const sceneHeight = dimensions.height;

            // Create the scene with proper background settings
            const sceneData = {
                name: name,
                img: uploadResult.path,
                width: sceneWidth,
                height: sceneHeight,
                grid: {
                    size: gridSize,
                    type: 1 // Square grid
                },
                padding: 0,
                initial: {
                    x: sceneWidth / 2,
                    y: sceneHeight / 2,
                    scale: 1.0  // Start at 1:1 scale so the map is visible
                },
                backgroundColor: "#000000",
                // Ensure the background image displays properly
                background: {
                    src: uploadResult.path,
                    scaleX: 1,
                    scaleY: 1,
                    offsetX: 0,
                    offsetY: 0
                },
                flags: {
                    "vibe-scenes": {
                        generated: true,
                        seed: seed,
                        timestamp: timestamp,
                        runId
                    }
                }
            };
            console.log(`Vibe Scenes | [${runId}] Scene data prepared`, sceneData);

            const sceneCreateStart = performance.now();
            const scene = await this._withTimeout(
                () => Scene.create(sceneData),
                { label: `create scene document (${name})`, timeoutMs: 60000, runId }
            );
            console.log(`Vibe Scenes | [${runId}] Scene document created in ${(performance.now() - sceneCreateStart).toFixed(0)}ms`, {
                sceneId: scene?.id,
                sceneName: scene?.name
            });

            if (!scene) {
                throw new Error("Failed to create scene document");
            }

            // Create Walls if provided
            if (walls && walls.length > 0) {
                console.log(`Vibe Scenes | [${runId}] Creating ${walls.length} walls...`);
                if (options.onProgress) options.onProgress("Building walls...", 30);
                const wallsStart = performance.now();
                try {
                    await this._withTimeout(
                        () => scene.createEmbeddedDocuments("Wall", walls),
                        { label: `create ${walls.length} walls`, timeoutMs: 90000, runId }
                    );
                    console.log(`Vibe Scenes | [${runId}] Walls created in ${(performance.now() - wallsStart).toFixed(0)}ms`);
                } catch (wallError) {
                    console.error(`Vibe Scenes | [${runId}] Wall creation failed`, wallError);
                    console.warn(`Vibe Scenes | [${runId}] Fallback: continuing without complete wall set`);
                }
            }

            // Create Tiles (Items) if provided
            if (items && items.length > 0) {
                console.log(`Vibe Scenes | [${runId}] Creating ${items.length} tiles...`);

                // LOGGING: Check for bad textures
                const uniqueTextures = new Set(items.filter(i => i.texture).map(i => i.texture));
                console.log(`Vibe Scenes | [${runId}] Unique textures used:`, Array.from(uniqueTextures));
                if (options.onProgress) options.onProgress("Validating tile textures...", 45);
                const textureValidationStart = performance.now();
                const textureValidity = await this._validateTextureSources(Array.from(uniqueTextures), runId);
                const invalidTextures = Array.from(textureValidity.entries())
                    .filter(([, ok]) => !ok)
                    .map(([src]) => src);
                if (invalidTextures.length > 0) {
                    console.warn(`Vibe Scenes | [${runId}] Invalid tile textures will be skipped`, {
                        invalidCount: invalidTextures.length,
                        invalidTextures
                    });
                    ui.notifications.warn(`Skipped ${invalidTextures.length} invalid tile texture(s). See console for details.`);
                }
                console.log(`Vibe Scenes | [${runId}] Texture validation finished in ${(performance.now() - textureValidationStart).toFixed(0)}ms`, {
                    total: uniqueTextures.size,
                    valid: uniqueTextures.size - invalidTextures.length,
                    invalid: invalidTextures.length
                });

                if (options.onProgress) options.onProgress("Verifying assets...", 50);

                // Create tiles in batches to avoid overwhelming the system
                const BATCH_SIZE = 50;
                const totalBatches = Math.ceil(items.length / BATCH_SIZE);

                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);
                    if (options.onProgress) {
                        const percent = 50 + Math.floor((i / items.length) * 40);
                        options.onProgress(`Placing tiles (${i}/${items.length})...`, percent);
                    }

                    const batchIndex = i / BATCH_SIZE + 1;
                    console.log(`Vibe Scenes | [${runId}] Creating tile batch ${batchIndex}/${totalBatches}`);

                    const batchStart = performance.now();
                    const tiles = batch
                        .filter(item => {
                            const isValid =
                                Number.isFinite(item.x) &&
                                Number.isFinite(item.y) &&
                                Number.isFinite(item.width) &&
                                item.width > 0 &&
                                Number.isFinite(item.height) &&
                                item.height > 0;

                            if (!isValid) {
                                console.warn(`Vibe Scenes | [${runId}] Skipping invalid item:`, item);
                            }
                            if (!isValid) return false;
                            const textureOk = textureValidity.get(item.texture) !== false;
                            if (!textureOk) {
                                console.warn(`Vibe Scenes | [${runId}] Skipping item with invalid texture`, {
                                    texture: item.texture,
                                    x: item.x,
                                    y: item.y
                                });
                            }
                            return textureOk;
                        })
                        .map(item => ({
                            texture: { src: item.texture },
                            x: item.x,
                            y: item.y,
                            width: item.width,
                            height: item.height,
                            rotation: item.rotation
                        }));

                    if (tiles.length > 0) {
                        try {
                            await this._withTimeout(
                                () => scene.createEmbeddedDocuments("Tile", tiles),
                                { label: `create tile batch ${batchIndex}/${totalBatches}`, timeoutMs: 120000, runId }
                            );
                            console.log(`Vibe Scenes | [${runId}] Tile batch ${batchIndex}/${totalBatches} created in ${(performance.now() - batchStart).toFixed(0)}ms`, {
                                requested: batch.length,
                                accepted: tiles.length
                            });
                        } catch (e) {
                            console.error(`Vibe Scenes | [${runId}] Failed to create tile batch ${batchIndex}/${totalBatches}:`, e);
                        }
                    }
                }
            }

            // Create Journal Entries and Notes if rooms provided
            if (rooms && rooms.length > 0) {
                console.log(`Vibe Scenes | [${runId}] Creating journal entries for rooms...`);
                const journalStart = performance.now();

                // Get or create folder
                let folder = game.folders.find(f => f.name === "Vibe Scenes Dungeons" && f.type === "JournalEntry");
                if (!folder) {
                    folder = await Folder.create({ name: "Vibe Scenes Dungeons", type: "JournalEntry" });
                }

                const folderName = `${name} (${new Date().toLocaleTimeString()})`;
                const sceneFolder = await Folder.create({
                    name: folderName,
                    type: "JournalEntry",
                    parent: folder.id
                });

                const notes = [];

                for (const room of rooms) {
                    if (room.description) {
                        const roomName = room.theme || `Room ${room.id}`;

                        const entry = await JournalEntry.create({
                            name: roomName,
                            pages: [{
                                name: "Description",
                                type: "text",
                                text: { content: room.description }
                            }],
                            folder: sceneFolder.id
                        });

                        const padding = gridSize * 2;
                        const centerX = (room.x + room.width / 2) * gridSize + padding;
                        const centerY = (room.y + room.height / 2) * gridSize + padding;

                        notes.push({
                            entryId: entry.id,
                            x: centerX,
                            y: centerY,
                            icon: "icons/svg/book.svg",
                            text: roomName,
                            fontSize: 20,
                            iconSize: 48
                        });
                    }
                }

                if (notes.length > 0) {
                    console.log(`Vibe Scenes | [${runId}] Creating ${notes.length} map notes...`);
                    if (options.onProgress) options.onProgress("Creating room notes...", 95);
                    try {
                        await this._withTimeout(
                            () => scene.createEmbeddedDocuments("Note", notes),
                            { label: `create ${notes.length} notes`, timeoutMs: 90000, runId }
                        );
                    } catch (noteError) {
                        console.error(`Vibe Scenes | [${runId}] Note creation failed`, noteError);
                        console.warn(`Vibe Scenes | [${runId}] Fallback: scene created without all room notes`);
                    }
                }
                console.log(`Vibe Scenes | [${runId}] Journal/note creation finished in ${(performance.now() - journalStart).toFixed(0)}ms`);
            }

            this._installCanvasDebugHooks(scene.id, runId);
            console.log(`Vibe Scenes | [${runId}] Scene created successfully: ${scene.id}`);
            console.log(`Vibe Scenes | [${runId}] Scene import total ${(performance.now() - startTime).toFixed(0)}ms`);
            return scene;
        } catch (error) {
            console.error(`Vibe Scenes | [${runId}] Scene import failed:`, error);
            throw error;
        } finally {
            console.groupEnd();
        }
    }

    _installCanvasDebugHooks(sceneId, runId) {
        const hookTag = `Vibe Scenes | [${runId}]`;
        const initHook = Hooks.on("canvasInit", (canvasRef) => {
            if (canvasRef?.scene?.id !== sceneId) return;
            console.log(`${hookTag} canvasInit`, {
                sceneId,
                width: canvasRef.dimensions?.width,
                height: canvasRef.dimensions?.height
            });
            Hooks.off("canvasInit", initHook);
        });
        const readyHook = Hooks.on("canvasReady", (canvasRef) => {
            if (canvasRef?.scene?.id !== sceneId) return;
            console.log(`${hookTag} canvasReady`, {
                sceneId,
                tokens: canvasRef.tokens?.placeables?.length || 0,
                tiles: canvasRef.tiles?.placeables?.length || 0,
                walls: canvasRef.walls?.placeables?.length || 0
            });
            Hooks.off("canvasReady", readyHook);
        });
    }

    /**
     * Ensure a directory exists in the user data folder
     */
    async _ensureDirectory(path) {
        const FP = foundry.applications.apps.FilePicker.implementation;
        try {
            console.log(`Vibe Scenes | Ensuring directory exists`, { path });
            await FP.browse("data", path);
            console.log(`Vibe Scenes | Directory exists`, { path });
        } catch (error) {
            console.warn(`Vibe Scenes | Directory browse failed, creating path segments`, { path, error: error?.message || String(error) });
            const parts = path.split('/');
            let currentPath = '';

            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                try {
                    await FP.browse("data", currentPath);
                } catch (e) {
                    console.log(`Vibe Scenes | Creating directory segment`, { currentPath });
                    await FP.createDirectory("data", currentPath);
                    console.log(`Vibe Scenes | Created directory segment`, { currentPath });
                }
            }
        }
    }

    /**
     * Upload a file to Foundry's data storage
     */
    async _uploadFile(file, targetPath) {
        const FP = foundry.applications.apps.FilePicker.implementation;
        try {
            console.log(`Vibe Scenes | Uploading file`, {
                targetPath,
                name: file?.name,
                size: file?.size || 0,
                type: file?.type
            });
            const response = await FP.upload("data", targetPath, file, {});
            console.log(`Vibe Scenes | Upload response`, response);
            return response;
        } catch (error) {
            console.error("Vibe Scenes | File upload error:", error);
            throw error;
        }
    }

    /**
     * Get dimensions of an image from its blob
     */
    async _getImageDimensions(imageBlob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageBlob);
            const timeout = setTimeout(() => {
                URL.revokeObjectURL(url);
                reject(new Error("Timed out loading image for dimension calculation"));
            }, 30000);

            img.onload = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };

            img.onerror = () => {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for dimension calculation"));
            };

            img.src = url;
        });
    }

    async _withTimeout(task, { label, timeoutMs = 30000, runId = "vs-unknown" } = {}) {
        const started = performance.now();
        console.log(`Vibe Scenes | [${runId}] async:start`, { label, timeoutMs });
        let timeoutHandle;
        try {
            const result = await Promise.race([
                Promise.resolve().then(() => task()),
                new Promise((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new Error(`Timed out after ${timeoutMs}ms: ${label}`));
                    }, timeoutMs);
                })
            ]);
            console.log(`Vibe Scenes | [${runId}] async:success`, {
                label,
                elapsedMs: Math.round(performance.now() - started)
            });
            return result;
        } catch (error) {
            console.error(`Vibe Scenes | [${runId}] async:failed`, {
                label,
                elapsedMs: Math.round(performance.now() - started),
                message: error?.message || String(error)
            });
            throw error;
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
        }
    }

    async _validateTextureSources(textureSources, runId) {
        const validity = new Map();
        for (const src of textureSources) {
            const ok = await this._isTextureLoadable(src, runId, 12000);
            validity.set(src, ok);
        }
        return validity;
    }

    async _isTextureLoadable(src, runId, timeoutMs = 12000) {
        if (!src || typeof src !== "string") return false;
        return new Promise((resolve) => {
            const img = new Image();
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.warn(`Vibe Scenes | [${runId}] Texture preflight timeout`, { src, timeoutMs });
                resolve(false);
            }, timeoutMs);

            img.onload = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                console.log(`Vibe Scenes | [${runId}] Texture preflight ok`, {
                    src,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
                resolve(true);
            };
            img.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                console.warn(`Vibe Scenes | [${runId}] Texture preflight failed`, { src });
                resolve(false);
            };

            img.crossOrigin = "Anonymous";
            img.src = `${src}${src.includes("?") ? "&" : "?"}vs_preflight=${Date.now()}`;
        });
    }
}
