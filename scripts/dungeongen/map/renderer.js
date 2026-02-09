/**
 * Dungeon Map Renderer
 * 
 * Canvas-based renderer for dungeon maps.
 * Creates PNG images from dungeon layouts.
 */

import { RoomShape, DoorType, ExitType } from '../layout/models.js';

/**
 * Rendering configuration
 */
const DEFAULT_CONFIG = {
    cellSize: 20,           // Pixels per grid cell
    wallThickness: 3,       // Wall line width
    floorColor: '#f8f4e8',  // Floor fill
    wallColor: '#333333',   // Wall stroke
    passageColor: '#f8f4e8',// Passage floor
    doorColor: '#8b4513',   // Door color
    gridColor: '#cccccc',   // Grid line color
    gridAlpha: 0.3,         // Grid transparency
    padding: 2,             // Grid cells of padding
    drawGrid: true,         // Whether to draw grid
    drawNumbers: true,      // Whether to draw room numbers
    shadowBlur: 5,          // Shadow blur radius
    shadowColor: 'rgba(0,0,0,0.3)'
};

/**
 * Dungeon renderer class
 */
export class DungeonRenderer {
    constructor(dungeon, options = {}) {
        this.dungeon = dungeon;
        this.config = { ...DEFAULT_CONFIG, ...options };
    }

    /**
     * Render dungeon to canvas and return as Blob
     */
    async renderToBlob() {
        const canvas = this.render();

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            }, 'image/png');
        });
    }

    /**
     * Render dungeon to canvas element
     */
    render() {
        const bounds = this.dungeon.bounds;
        const padding = this.config.padding;
        const cellSize = this.config.cellSize;

        // Calculate canvas size
        const width = (bounds.x2 - bounds.x1 + padding * 2) * cellSize;
        const height = (bounds.y2 - bounds.y1 + padding * 2) * cellSize;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(100, width);
        canvas.height = Math.max(100, height);

        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Setup transform to center dungeon
        const offsetX = (padding - bounds.x1) * cellSize;
        const offsetY = (padding - bounds.y1) * cellSize;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Draw layers in order
        this._drawPassages(ctx);
        this._drawRooms(ctx);
        this._drawDoors(ctx);
        this._drawExits(ctx);

        if (this.config.drawGrid) {
            this._drawGrid(ctx, bounds);
        }

        if (this.config.drawNumbers) {
            this._drawRoomNumbers(ctx);
        }

        ctx.restore();

        return canvas;
    }

    /**
     * Draw all passages
     */
    _drawPassages(ctx) {
        const cellSize = this.config.cellSize;

        ctx.fillStyle = this.config.passageColor;
        ctx.strokeStyle = this.config.wallColor;
        ctx.lineWidth = this.config.wallThickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const passage of this.dungeon.passages) {
            if (passage.waypoints.length < 2) continue;

            const corridorWidth = cellSize;

            // Draw passage as thick line
            ctx.beginPath();
            const wp = passage.waypoints;

            for (let i = 0; i < wp.length - 1; i++) {
                const x1 = wp[i].x * cellSize + cellSize / 2;
                const y1 = wp[i].y * cellSize + cellSize / 2;
                const x2 = wp[i + 1].x * cellSize + cellSize / 2;
                const y2 = wp[i + 1].y * cellSize + cellSize / 2;

                // Draw filled corridor
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);

                if (len > 0) {
                    // Perpendicular direction
                    const px = -dy / len * (corridorWidth / 2);
                    const py = dx / len * (corridorWidth / 2);

                    ctx.save();
                    ctx.fillStyle = this.config.passageColor;
                    ctx.beginPath();
                    ctx.moveTo(x1 + px, y1 + py);
                    ctx.lineTo(x2 + px, y2 + py);
                    ctx.lineTo(x2 - px, y2 - py);
                    ctx.lineTo(x1 - px, y1 - py);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Draw walls
            ctx.beginPath();
            for (let i = 0; i < wp.length - 1; i++) {
                const x1 = wp[i].x * cellSize + cellSize / 2;
                const y1 = wp[i].y * cellSize + cellSize / 2;
                const x2 = wp[i + 1].x * cellSize + cellSize / 2;
                const y2 = wp[i + 1].y * cellSize + cellSize / 2;

                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);

                if (len > 0) {
                    const px = -dy / len * (corridorWidth / 2);
                    const py = dx / len * (corridorWidth / 2);

                    // Left wall
                    ctx.moveTo(x1 + px, y1 + py);
                    ctx.lineTo(x2 + px, y2 + py);

                    // Right wall
                    ctx.moveTo(x1 - px, y1 - py);
                    ctx.lineTo(x2 - px, y2 - py);
                }
            }
            ctx.stroke();
        }
    }

    /**
     * Draw all rooms
     */
    _drawRooms(ctx) {
        const cellSize = this.config.cellSize;

        // Draw shadow layer first
        ctx.save();
        ctx.shadowBlur = this.config.shadowBlur;
        ctx.shadowColor = this.config.shadowColor;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        for (const room of this.dungeon.rooms) {
            this._drawRoomFill(ctx, room);
        }
        ctx.restore();

        // Draw fills (overlapping shadow)
        for (const room of this.dungeon.rooms) {
            this._drawRoomFill(ctx, room);
        }

        // Draw walls
        ctx.strokeStyle = this.config.wallColor;
        ctx.lineWidth = this.config.wallThickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const room of this.dungeon.rooms) {
            this._drawRoomWalls(ctx, room);
        }
    }

    /**
     * Draw room fill
     */
    _drawRoomFill(ctx, room) {
        const cellSize = this.config.cellSize;
        const x = room.x * cellSize;
        const y = room.y * cellSize;
        const w = room.width * cellSize;
        const h = room.height * cellSize;

        ctx.fillStyle = this.config.floorColor;

        if (room.shape === RoomShape.CIRCLE) {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const r = Math.min(w, h) / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, w, h);
        }
    }

    /**
     * Draw room walls
     */
    _drawRoomWalls(ctx, room) {
        const cellSize = this.config.cellSize;
        const x = room.x * cellSize;
        const y = room.y * cellSize;
        const w = room.width * cellSize;
        const h = room.height * cellSize;

        if (room.shape === RoomShape.CIRCLE) {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const r = Math.min(w, h) / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeRect(x, y, w, h);
        }
    }

    /**
     * Draw all doors
     */
    _drawDoors(ctx) {
        const cellSize = this.config.cellSize;
        const doorSize = cellSize * 0.8;

        for (const door of this.dungeon.doors) {
            const x = door.x * cellSize + cellSize / 2;
            const y = door.y * cellSize + cellSize / 2;

            ctx.save();
            ctx.translate(x, y);

            // Rotate based on direction
            const angles = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
            ctx.rotate(angles[door.direction] || 0);

            // Draw door
            ctx.fillStyle = this.config.doorColor;
            ctx.strokeStyle = this.config.wallColor;
            ctx.lineWidth = 2;

            if (door.doorType === DoorType.OPEN) {
                // Open doorway - just an arc
                ctx.beginPath();
                ctx.arc(0, -doorSize / 4, doorSize / 3, 0, Math.PI);
                ctx.stroke();
            } else {
                // Closed door - rectangle
                ctx.fillRect(-doorSize / 3, -doorSize / 4, doorSize * 2 / 3, doorSize / 2);
                ctx.strokeRect(-doorSize / 3, -doorSize / 4, doorSize * 2 / 3, doorSize / 2);
            }

            ctx.restore();
        }
    }

    /**
     * Draw dungeon exits
     */
    _drawExits(ctx) {
        const cellSize = this.config.cellSize;

        for (const exit of this.dungeon.exits) {
            const x = exit.x * cellSize + cellSize / 2;
            const y = exit.y * cellSize + cellSize / 2;

            ctx.save();
            ctx.translate(x, y);

            // Draw entrance symbol (stairs)
            ctx.strokeStyle = this.config.wallColor;
            ctx.lineWidth = 2;

            // Draw stairs icon
            const size = cellSize * 0.6;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const stepY = -size / 2 + (i * size / 4);
                const stepWidth = size * (1 - i * 0.15);
                ctx.moveTo(-stepWidth / 2, stepY);
                ctx.lineTo(stepWidth / 2, stepY);
            }
            ctx.stroke();

            // Arrow if main entrance
            if (exit.isMain) {
                ctx.fillStyle = '#228b22';
                ctx.beginPath();
                ctx.moveTo(0, -size / 2 - 5);
                ctx.lineTo(-5, -size / 2 - 15);
                ctx.lineTo(5, -size / 2 - 15);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /**
     * Draw grid overlay
     */
    _drawGrid(ctx, bounds) {
        const cellSize = this.config.cellSize;

        ctx.save();
        ctx.strokeStyle = this.config.gridColor;
        ctx.globalAlpha = this.config.gridAlpha;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = bounds.x1; x <= bounds.x2; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, bounds.y1 * cellSize);
            ctx.lineTo(x * cellSize, bounds.y2 * cellSize);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = bounds.y1; y <= bounds.y2; y++) {
            ctx.beginPath();
            ctx.moveTo(bounds.x1 * cellSize, y * cellSize);
            ctx.lineTo(bounds.x2 * cellSize, y * cellSize);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Draw room numbers
     */
    _drawRoomNumbers(ctx) {
        const cellSize = this.config.cellSize;

        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.max(12, cellSize / 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const room of this.dungeon.rooms) {
            if (room.number > 0) {
                const center = room.centerWorld;
                const x = center.x * cellSize;
                const y = center.y * cellSize;

                // Draw background circle
                const radius = Math.max(10, cellSize / 3);
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Draw number
                ctx.fillText(room.number.toString(), x, y);
            }
        }

        ctx.restore();
    }
}
