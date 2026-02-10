/**
 * Vertical Connectivity
 * 
 * Handles placement of stairs (Up/Down) to connect dungeon levels.
 */

import { CellType, Stair } from './models.js';

export class VerticalPlacer {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = options;
    }

    placeStairs() {
        // Default: 1 Up, 1 Down
        // Options can specify counts
        const numUp = this.options.stairs?.up ?? 1;
        const numDown = this.options.stairs?.down ?? 1;

        // 1. Place UP stairs (Entrances)
        // Usually in the first room or near center if no rooms
        if (numUp > 0) {
            this._placeStairsType('up', numUp);
        }

        // 2. Place DOWN stairs (Exits to deeper levels)
        // Usually in far rooms or dead ends
        if (numDown > 0) {
            this._placeStairsType('down', numDown);
        }
    }

    _placeStairsType(type, count) {
        let placed = 0;
        const rooms = this.grid.rooms;

        // Strategy: 
        // UP: First room (index 0 is usually first placed)
        // DOWN: Last room (index N is usually last placed/furthest) or Dead Ends

        if (type === 'up') {
            // Try explicit rooms first, using the first few rooms for entrances
            for (let i = 0; i < rooms.length; i++) {
                if (placed >= count) break;
                const r = rooms[i];
                // Check if occupied?
                if (this._hasStairsAt(r.center.x, r.center.y)) continue;

                this.grid.stairs.push(new Stair(r.center.x, r.center.y, 'up'));
                placed++;
            }
        } else if (type === 'down') {
            // Priority: Dead Ends > Far Rooms

            // Find dead ends (passages with 1 neighbor)
            const deadEnds = this._findDeadEnds();

            // Shuffle dead ends
            for (let i = deadEnds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
            }

            while (placed < count && deadEnds.length > 0) {
                const p = deadEnds.pop();
                this.grid.stairs.push(new Stair(p.x, p.y, 'down'));
                placed++;
            }

            // If we still need more, use last rooms in reverse order
            if (placed < count && rooms.length > 1) {
                for (let i = rooms.length - 1; i > 0; i--) {
                    if (placed >= count) break;
                    const r = rooms[i];
                    // Check if room already has stairs
                    // (Simple check: center)
                    if (this._hasStairsAt(r.center.x, r.center.y)) continue;

                    this.grid.stairs.push(new Stair(r.center.x, r.center.y, 'down'));
                    placed++;
                }
            }
        }
    }

    _findDeadEnds() {
        const deadEnds = [];
        for (let y = 1; y < this.grid.height - 1; y++) {
            for (let x = 1; x < this.grid.width - 1; x++) {
                if (this.grid.get(x, y) !== CellType.FLOOR) continue;

                // Skip if it's inside a room
                if (this._getRoomAt(x, y)) continue;

                const n = this.grid.getNeighbors(x, y);
                if (n.length === 1) {
                    deadEnds.push({ x, y });
                }
            }
        }
        return deadEnds;
    }

    _getRoomAt(x, y) {
        return this.grid.rooms.find(r =>
            x >= r.x && x < r.x + r.width &&
            y >= r.y && y < r.y + r.height
        );
    }

    _hasStairsAt(x, y) {
        return this.grid.stairs.some(s => s.x === x && s.y === y);
    }
}
