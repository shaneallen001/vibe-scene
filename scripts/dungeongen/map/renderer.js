/**
 * Grid-Based Dungeon Renderer
 * 
 * Renders the DungeonGrid state to a canvas.
 */

import { CellType } from '../layout/models.js';

export class DungeonRenderer {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = {
            cellSize: 20,
            floorColor: '#f0f0f0',
            floorTexture: null,       // Path to default floor texture image
            roomTextures: {},          // Map of room ID to floor texture path
            wallColor: '#111111',
            wallTexture: null,         // Path to default wall texture image
            roomWallTextures: {},      // Map of room ID to wall texture path
            wallEdgeColor: '#0a0a0a',
            wallEdgeWidth: 1.5,
            doorColor: '#8b4513',
            wallThickness: 2,
            ...options
        };
    }

    /**
     * Render dungeon to canvas and return as Blob
     */
    async renderToBlob() {
        const renderTrace = `vs-render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const renderStart = performance.now();
        console.groupCollapsed(`Vibe Scenes | [${renderTrace}] DungeonRenderer.renderToBlob`);
        try {
            // Load floor texture if needed
            let floorImage = null;
            if (this.options.floorTexture) {
                console.log(`Vibe Scenes | [${renderTrace}] Loading default floor texture`, { path: this.options.floorTexture });
                try {
                    floorImage = await this._loadFloorImage(this.options.floorTexture, { traceId: `${renderTrace}-default` });
                    console.log(`Vibe Scenes | [${renderTrace}] Default floor texture loaded`, {
                        width: floorImage.naturalWidth,
                        height: floorImage.naturalHeight
                    });
                } catch (err) {
                    console.warn(`Vibe Scenes | [${renderTrace}] Failed to load default floor texture; fallback to color`, {
                        path: this.options.floorTexture,
                        error: err?.message || String(err)
                    });
                }
            } else {
                console.warn(`Vibe Scenes | [${renderTrace}] No default floor texture configured; fallback color`, {
                    floorColor: this.options.floorColor
                });
            }

            // Load room floor textures
            const roomImages = {};
            if (this.options.roomTextures) {
                const roomTextureEntries = Object.entries(this.options.roomTextures);
                console.log(`Vibe Scenes | [${renderTrace}] Loading room textures`, { count: roomTextureEntries.length });
                for (const [id, path] of roomTextureEntries) {
                    try {
                        roomImages[id] = await this._loadFloorImage(path, { traceId: `${renderTrace}-room-${id}` });
                        console.log(`Vibe Scenes | [${renderTrace}] Room texture loaded`, { roomId: id, path });
                    } catch (err) {
                        console.warn(`Vibe Scenes | [${renderTrace}] Failed room texture load; room falls back to default`, {
                            roomId: id,
                            path,
                            error: err?.message || String(err)
                        });
                    }
                }
            }

            // Load wall texture
            let wallImage = null;
            if (this.options.wallTexture) {
                console.log(`Vibe Scenes | [${renderTrace}] Loading default wall texture`, { path: this.options.wallTexture });
                try {
                    wallImage = await this._loadFloorImage(this.options.wallTexture, { traceId: `${renderTrace}-wall-default` });
                    console.log(`Vibe Scenes | [${renderTrace}] Default wall texture loaded`, {
                        width: wallImage.naturalWidth,
                        height: wallImage.naturalHeight
                    });
                } catch (err) {
                    console.warn(`Vibe Scenes | [${renderTrace}] Failed to load default wall texture; fallback to color`, {
                        path: this.options.wallTexture,
                        error: err?.message || String(err)
                    });
                }
            }

            // Load per-room wall textures
            const roomWallImages = {};
            if (this.options.roomWallTextures) {
                const roomWallEntries = Object.entries(this.options.roomWallTextures);
                console.log(`Vibe Scenes | [${renderTrace}] Loading room wall textures`, { count: roomWallEntries.length });
                for (const [id, path] of roomWallEntries) {
                    try {
                        roomWallImages[id] = await this._loadFloorImage(path, { traceId: `${renderTrace}-roomwall-${id}` });
                        console.log(`Vibe Scenes | [${renderTrace}] Room wall texture loaded`, { roomId: id, path });
                    } catch (err) {
                        console.warn(`Vibe Scenes | [${renderTrace}] Failed room wall texture load; falls back to default wall`, {
                            roomId: id,
                            path,
                            error: err?.message || String(err)
                        });
                    }
                }
            }

            console.log(`Vibe Scenes | [${renderTrace}] Rendering canvas layers...`);
            const canvas = this.render(floorImage, roomImages, wallImage, roomWallImages);
            console.log(`Vibe Scenes | [${renderTrace}] Canvas rendered`, { width: canvas.width, height: canvas.height });

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob from canvas'));
                    }
                }, 'image/png');
            });
            console.log(`Vibe Scenes | [${renderTrace}] Blob created`, {
                bytes: blob?.size || 0,
                elapsedMs: Math.round(performance.now() - renderStart)
            });
            return blob;
        } finally {
            console.groupEnd();
        }
    }

    _loadFloorImage(src, { timeoutMs = 20000, traceId = "texture-load" } = {}) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`Timed out loading texture after ${timeoutMs}ms: ${src}`));
            }, timeoutMs);
            // Handle cross-origin if needed, though mostly local
            img.crossOrigin = "Anonymous";
            console.log(`Vibe Scenes | [${traceId}] Texture load request`, { src, timeoutMs });
            img.src = src;
            img.onload = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(img);
            };
            img.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(new Error(`Image failed to load: ${src}`));
            };
        });
    }

    render(floorImage = null, roomImages = {}, wallImage = null, roomWallImages = {}) {
        const canvas = document.createElement('canvas');
        const cellSize = this.options.cellSize;
        const padding = cellSize * 2;

        canvas.width = this.grid.width * cellSize + padding * 2;
        canvas.height = this.grid.height * cellSize + padding * 2;

        const ctx = canvas.getContext('2d');
        ctx.translate(padding, padding);

        // 1. Draw Floor (FLOOR cells only)
        this._drawFloor(ctx, floorImage, roomImages);

        // 2. Draw Wall Textures (WALL cells)
        this._drawWallTextures(ctx, wallImage, roomWallImages);

        // 3. Draw Wall Edge Outlines (WALL/EMPTY boundary)
        this._drawWallEdges(ctx);

        // 4. Draw Doors
        this._drawDoors(ctx);

        // 5. Draw Room Numbers (Debug)
        if (this.options.drawNumbers) {
            this._drawRoomNumbers(ctx);
        }

        return canvas;
    }

    _drawFloor(ctx, floorImage, roomImages) {
        const cellSize = this.options.cellSize;
        // Scale textures so each tile covers a reasonable number of grid cells
        const patternSize = cellSize * 4;

        // 1. Draw Default Floor (Background)
        if (floorImage) {
            try {
                const scaledFloor = this._scaleImageForPattern(floorImage, patternSize);
                const pattern = ctx.createPattern(scaledFloor, 'repeat');
                ctx.fillStyle = pattern;
            } catch (e) {
                ctx.fillStyle = this.options.floorColor;
            }
        } else {
            ctx.fillStyle = this.options.floorColor;
        }

        // Fill FLOOR cells with default texture (excludes WALL cells)
        ctx.beginPath();
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                if (this.grid.get(x, y) === CellType.FLOOR) {
                    ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
        ctx.fill();

        // 2. Draw Room Specific Textures
        if (this.grid.rooms && Object.keys(roomImages).length > 0) {
            for (const room of this.grid.rooms) {
                const img = roomImages[room.id];
                if (!img) continue;

                // Create mask path for room
                ctx.save();
                ctx.beginPath();
                ctx.rect(
                    room.x * cellSize,
                    room.y * cellSize,
                    room.width * cellSize,
                    room.height * cellSize
                );
                ctx.clip();

                // Draw texture scaled to match the grid
                try {
                    const scaledRoom = this._scaleImageForPattern(img, patternSize);
                    const pattern = ctx.createPattern(scaledRoom, 'repeat');
                    ctx.fillStyle = pattern;
                    ctx.fillRect(
                        room.x * cellSize,
                        room.y * cellSize,
                        room.width * cellSize,
                        room.height * cellSize
                    );
                } catch (e) {
                    console.warn("Failed to draw room pattern", e);
                }
                ctx.restore();
            }
        }
    }

    /**
     * Scale an image to a target size for use as a repeating pattern tile.
     * This ensures textures tile at a size proportional to the grid cells
     * rather than at their native resolution (which may be much larger).
     * @param {HTMLImageElement} img - Source image
     * @param {number} targetSize - Desired tile size in pixels
     * @returns {HTMLCanvasElement} - Scaled canvas to use with createPattern
     */
    _scaleImageForPattern(img, targetSize) {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        return canvas;
    }

    /**
     * Fill WALL cells with a tiled wall texture pattern.
     * Per-room wall textures are applied by determining which room each wall cell
     * is adjacent to and clipping to that room's expanded bounding box.
     */
    _drawWallTextures(ctx, wallImage, roomWallImages = {}) {
        const cellSize = this.options.cellSize;
        const patternSize = cellSize * 4;

        // Phase 1: Fill all WALL cells with default wall texture (or fallback color)
        if (wallImage) {
            try {
                const scaledWall = this._scaleImageForPattern(wallImage, patternSize);
                const pattern = ctx.createPattern(scaledWall, 'repeat');
                ctx.fillStyle = pattern;
            } catch (e) {
                ctx.fillStyle = this.options.wallColor;
            }
        } else {
            ctx.fillStyle = this.options.wallColor;
        }

        ctx.beginPath();
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                if (this.grid.get(x, y) === CellType.WALL) {
                    ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
        ctx.fill();

        // Phase 2: Overlay per-room wall textures
        if (this.grid.rooms && Object.keys(roomWallImages).length > 0) {
            const wallExpand = 2;
            for (const room of this.grid.rooms) {
                const img = roomWallImages[room.id];
                if (!img) continue;

                ctx.save();
                // Clip to expanded room bounding box (room + wall band)
                const clipX = (room.x - wallExpand) * cellSize;
                const clipY = (room.y - wallExpand) * cellSize;
                const clipW = (room.width + wallExpand * 2) * cellSize;
                const clipH = (room.height + wallExpand * 2) * cellSize;

                // Build clip path from only WALL cells within this expanded region
                ctx.beginPath();
                for (let gy = room.y - wallExpand; gy < room.y + room.height + wallExpand; gy++) {
                    for (let gx = room.x - wallExpand; gx < room.x + room.width + wallExpand; gx++) {
                        if (this.grid.get(gx, gy) === CellType.WALL) {
                            ctx.rect(gx * cellSize, gy * cellSize, cellSize, cellSize);
                        }
                    }
                }
                ctx.clip();

                try {
                    const scaledRoom = this._scaleImageForPattern(img, patternSize);
                    const pattern = ctx.createPattern(scaledRoom, 'repeat');
                    ctx.fillStyle = pattern;
                    ctx.fillRect(clipX, clipY, clipW, clipH);
                } catch (e) {
                    console.warn("Failed to draw room wall pattern", e);
                }
                ctx.restore();
            }
        }
    }

    /**
     * Draw thin crisp outlines on the boundary between WALL and EMPTY cells
     * (the outer edge of the wall band) for visual definition.
     */
    _drawWallEdges(ctx) {
        const cellSize = this.options.cellSize;
        ctx.strokeStyle = this.options.wallEdgeColor;
        ctx.lineWidth = this.options.wallEdgeWidth;
        ctx.lineCap = 'square';

        ctx.beginPath();
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                if (this.grid.get(x, y) !== CellType.WALL) continue;

                const cx = x * cellSize;
                const cy = y * cellSize;

                // Draw edge on each side that borders EMPTY (or out-of-bounds)
                if (this.grid.get(x, y - 1) === CellType.EMPTY) {
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + cellSize, cy);
                }
                if (this.grid.get(x + 1, y) === CellType.EMPTY) {
                    ctx.moveTo(cx + cellSize, cy);
                    ctx.lineTo(cx + cellSize, cy + cellSize);
                }
                if (this.grid.get(x, y + 1) === CellType.EMPTY) {
                    ctx.moveTo(cx, cy + cellSize);
                    ctx.lineTo(cx + cellSize, cy + cellSize);
                }
                if (this.grid.get(x - 1, y) === CellType.EMPTY) {
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx, cy + cellSize);
                }
            }
        }
        ctx.stroke();
    }

    _drawDoors(ctx) {
        const cellSize = this.options.cellSize;
        const thickness = cellSize / 3;

        ctx.fillStyle = this.options.doorColor;

        for (const door of this.grid.doors) {
            let x, y, w, h;

            // Doors are now centered in the cell (x, y)
            const cx = door.x * cellSize + cellSize / 2;
            const cy = door.y * cellSize + cellSize / 2;

            if (door.direction === 'horizontal') {
                // Horizontal door: Wide but short
                // Blocks Top-Bottom movement
                w = cellSize;
                h = thickness;
                x = cx - w / 2;
                y = cy - h / 2;
            } else {
                // Vertical door: Tall but narrow
                // Blocks Left-Right movement
                w = thickness;
                h = cellSize;
                x = cx - w / 2;
                y = cy - h / 2;
            }

            ctx.fillRect(x, y, w, h);
        }
    }

    /**
     * Draw stairs with visual distinction between UP and DOWN
     */


    _drawRoomNumbers(ctx) {
        const cellSize = this.options.cellSize;
        ctx.fillStyle = 'black';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.grid.rooms) {
            let i = 1;
            for (const room of this.grid.rooms) {
                const cx = (room.x + room.width / 2) * cellSize;
                const cy = (room.y + room.height / 2) * cellSize;
                ctx.fillText(i++, cx, cy);
            }
        }
    }
}
