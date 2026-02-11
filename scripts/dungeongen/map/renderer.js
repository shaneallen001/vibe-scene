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
            wallColor: '#222222',
            doorColor: '#8b4513',
            wallThickness: 2,
            ...options
        };
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

    render() {
        // Create canvas
        const canvas = document.createElement('canvas');
        const cellSize = this.options.cellSize;
        const padding = cellSize * 2; // Padding around the grid

        canvas.width = this.grid.width * cellSize + padding * 2;
        canvas.height = this.grid.height * cellSize + padding * 2;

        const ctx = canvas.getContext('2d');

        // Translate to padding
        ctx.translate(padding, padding);

        // 1. Draw Floor
        this._drawFloor(ctx);

        // 2. Draw Walls
        this._drawWalls(ctx);

        // 3. Draw Doors
        this._drawDoors(ctx);

        // 4. Draw Stairs (New)
        this._drawStairs(ctx);

        // 5. Draw Room Numbers (Debug)
        if (this.options.drawNumbers) {
            this._drawRoomNumbers(ctx);
        }

        return canvas;
    }

    _drawFloor(ctx) {
        const cellSize = this.options.cellSize;
        ctx.fillStyle = this.options.floorColor;

        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cell = this.grid.get(x, y);
                if (cell !== CellType.EMPTY) {
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    _drawWalls(ctx) {
        const cellSize = this.options.cellSize;
        ctx.strokeStyle = this.options.wallColor;
        ctx.lineWidth = this.options.wallThickness;
        ctx.lineCap = 'square';

        ctx.beginPath();

        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cell = this.grid.get(x, y);
                if (cell === CellType.EMPTY) continue; // Skip empty cells

                // Check neighbors to decide if we need a wall
                const neighbors = [
                    { dx: 0, dy: -1, side: 'top' },
                    { dx: 1, dy: 0, side: 'right' },
                    { dx: 0, dy: 1, side: 'bottom' },
                    { dx: -1, dy: 0, side: 'left' }
                ];

                for (const { dx, dy, side } of neighbors) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const neighborCell = this.grid.get(nx, ny);

                    // If neighbor is EMPTY, draw wall on this side
                    // Also if neighbor is out of bounds, draw wall
                    if (neighborCell === CellType.EMPTY) {
                        this._drawWallSegment(ctx, x, y, side, cellSize);
                    }
                }
            }
        }
        ctx.stroke();
    }

    _drawWallSegment(ctx, x, y, side, cellSize) {
        const cx = x * cellSize;
        const cy = y * cellSize;

        // Adjust for line width to overlap slightly? 
        // Or just center on grid lines?
        // Let's standard draw on edge.

        switch (side) {
            case 'top':
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + cellSize, cy);
                break;
            case 'right':
                ctx.moveTo(cx + cellSize, cy);
                ctx.lineTo(cx + cellSize, cy + cellSize);
                break;
            case 'bottom':
                ctx.moveTo(cx, cy + cellSize);
                ctx.lineTo(cx + cellSize, cy + cellSize);
                break;
            case 'left':
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx, cy + cellSize);
                break;
        }
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
    _drawStairs(ctx) {
        const cellSize = this.options.cellSize;

        // Settings for stairs
        const upColor = '#cccccc'; // Light gray for UP
        const downColor = '#666666'; // Dark gray for DOWN
        const stepColor = '#000000';
        const textColor = '#ffffff';

        for (const stair of this.grid.stairs) {
            const x = stair.x * cellSize;
            const y = stair.y * cellSize;

            // 1. Background Fill
            ctx.fillStyle = stair.type === 'up' ? upColor : downColor;
            ctx.fillRect(x, y, cellSize, cellSize);

            // 2. Draw "Steps" (Horizontal lines)
            ctx.strokeStyle = stepColor;
            ctx.lineWidth = 1;
            ctx.beginPath();

            // Draw 3-4 lines to simulate steps
            const steps = 4;
            const stepGap = cellSize / steps;

            for (let i = 1; i < steps; i++) {
                const ly = y + i * stepGap;
                ctx.moveTo(x, ly);
                ctx.lineTo(x + cellSize, ly);
            }
            ctx.stroke();

            // 3. Draw Label (UP/DN)
            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.floor(cellSize / 2.5)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Add text shadow for readability
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;

            const label = stair.type === 'up' ? "UP" : "DN";
            const cx = x + cellSize / 2;
            const cy = y + cellSize / 2;

            ctx.strokeText(label, cx, cy);
            ctx.fillText(label, cx, cy);
        }
    }

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
