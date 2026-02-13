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
     * @param {number} options.gridSize - Grid size in pixels
     * @param {number} options.seed - Seed used for generation (for metadata)
     * @returns {Promise<Scene>} - Created scene document
     */
    async createScene(options) {
        const { name, imageData, walls, items, gridSize, seed } = options;

        console.log("Vibe Scenes | Creating scene:", name);

        // Get storage path from settings
        const storagePath = game.settings.get("vibe-scenes", "imageStorage") || "vibe-scenes/dungeons";

        // Ensure the directory exists
        await this._ensureDirectory(storagePath);

        // Generate filename
        const timestamp = Date.now();
        const filename = `dungeon_${seed}_${timestamp}.png`;
        const filePath = `${storagePath}/${filename}`;

        // Upload the image
        const file = new File([imageData], filename, { type: 'image/png' });
        const uploadResult = await this._uploadFile(file, storagePath);
        console.log("Vibe Scenes | Upload result:", uploadResult);

        if (!uploadResult) {
            throw new Error("Failed to upload dungeon image");
        }

        // Get image dimensions
        const dimensions = await this._getImageDimensions(imageData);
        console.log("Vibe Scenes | Image dimensions:", dimensions);

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
                    timestamp: timestamp
                }
            }
        };
        console.log("Vibe Scenes | Scene data:", sceneData);

        const scene = await Scene.create(sceneData);

        if (!scene) {
            throw new Error("Failed to create scene document");
        }

        // Create Walls if provided
        if (walls && walls.length > 0) {
            console.log(`Vibe Scenes | Creating ${walls.length} walls...`);
            await scene.createEmbeddedDocuments("Wall", walls);
        }

        // Create Tiles (Items) if provided
        if (items && items.length > 0) {
            console.log(`Vibe Scenes | Creating ${items.length} tiles...`);

            // LOGGING: Check for bad textures
            const uniqueTextures = new Set(items.map(i => i.texture));
            console.log("Vibe Scenes | Unique textures used:", Array.from(uniqueTextures));

            const tiles = items.map(item => ({
                texture: { src: item.texture },
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                rotation: item.rotation
            }));
            await scene.createEmbeddedDocuments("Tile", tiles);
        }

        console.log("Vibe Scenes | Scene created successfully:", scene.id);
        return scene;
    }

    /**
     * Ensure a directory exists in the user data folder
     */
    async _ensureDirectory(path) {
        try {
            // Try to browse the directory first
            await FilePicker.browse("data", path);
        } catch (error) {
            // Directory doesn't exist, create it
            const parts = path.split('/');
            let currentPath = '';

            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                try {
                    await FilePicker.browse("data", currentPath);
                } catch (e) {
                    await FilePicker.createDirectory("data", currentPath);
                }
            }
        }
    }

    /**
     * Upload a file to Foundry's data storage
     */
    async _uploadFile(file, targetPath) {
        try {
            const response = await FilePicker.upload("data", targetPath, file, {});
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

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for dimension calculation"));
            };

            img.src = url;
        });
    }
}
