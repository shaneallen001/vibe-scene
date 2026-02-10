/**
 * Door Placement Logic
 * 
 * Handles valid placement of doors at room connections and corridor chokepoints.
 */

import { CellType, Door } from './models.js';

export class DoorPlacer {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = options;
        this.density = options.doorDensity ?? 1.0; // Probability of placing a valid door
    }

    placeDoors() {
        this.grid.doors = []; // Reset

        for (let y = 1; y < this.grid.height - 1; y++) {
            for (let x = 1; x < this.grid.width - 1; x++) {
                if (this.grid.get(x, y) !== CellType.FLOOR) continue;

                // 1. Basic Validity Checks
                if (this._isOccupied(x, y)) continue;
                if (this._isInsideRoom(x, y)) continue; // Don't place doors inside rooms

                // 2. Geometry Check & Direction
                // Vertical Door: Blocks Left-Right movement (Walls on N/S, Floors on W/E)
                // Horizontal Door: Blocks Top-Bottom movement (Walls on W/E, Floors on N/S)

                const n = this.grid.get(x, y - 1) === CellType.FLOOR;
                const s = this.grid.get(x, y + 1) === CellType.FLOOR;
                const e = this.grid.get(x + 1, y) === CellType.FLOOR;
                const w = this.grid.get(x - 1, y) === CellType.FLOOR;

                let direction = null;

                if (w && e && !n && !s) {
                    direction = 'vertical';
                } else if (n && s && !w && !e) {
                    direction = 'horizontal';
                } else {
                    continue; // Not a valid chokepoint/doorway shape
                }

                // 3. Significance Check (Room Connection)
                // We mainly want doors that lead to rooms.
                // Check if one side is a room and the other is... whatever (corridor or another room)
                if (!this._connectsToRoom(x, y, direction)) continue;

                // 4. Neighbor Check (Don't place doors right next to each other)
                if (this._hasDoorNeighbor(x, y)) continue;

                // 5. Chance (Density)
                if (Math.random() > this.density) continue;

                // Place Valid Door
                this.grid.doors.push(new Door(x, y, direction));
            }
        }
    }

    _isOccupied(x, y) {
        // Check Stairs
        if (this.grid.stairs.some(s => s.x === x && s.y === y)) return true;
        // Check Existing Doors (though we clear them)
        if (this.grid.doors.some(d => d.x === x && d.y === y)) return true;
        return false;
    }

    _isInsideRoom(x, y) {
        // Check if point is strictly inside a room (not just on edge, though our rooms are floor rects)
        // Actually, our rooms include walls or just floors? 
        // In this model, rooms are just metadata regions. The grid has FLOOR.
        // We usually place doors at the *entry* to a room.
        // If a cell is IN a room, it's usually part of the open space.
        // A door implies a wall was cut? Or a chokepoint.
        // If we are "inside" a room, n/s/e/w are likely all floors, so geometry check fails anyway.
        // But for 1-tile wide necks inside a room (rare), we might skip.
        return !!this._getRoomAt(x, y);
    }

    _getRoomAt(x, y) {
        return this.grid.rooms.find(r =>
            x >= r.x && x < r.x + r.width &&
            y >= r.y && y < r.y + r.height
        );
    }

    _connectsToRoom(x, y, direction) {
        // Check neighbor cells based on direction
        // Vertical Door ( connects left-right)
        if (direction === 'vertical') {
            const roomLeft = this._getRoomAt(x - 1, y);
            const roomRight = this._getRoomAt(x + 1, y);
            return !!(roomLeft || roomRight);
        }
        // Horizontal Door (connects up-down)
        if (direction === 'horizontal') {
            const roomUp = this._getRoomAt(x, y - 1);
            const roomDown = this._getRoomAt(x, y + 1);
            return !!(roomUp || roomDown);
        }
        return false;
    }

    _hasDoorNeighbor(x, y) {
        // Check correlation with other doors to avoid clustering
        for (const d of this.grid.doors) {
            if (Math.abs(d.x - x) + Math.abs(d.y - y) <= 1) return true;
        }
        return false;
    }
}
