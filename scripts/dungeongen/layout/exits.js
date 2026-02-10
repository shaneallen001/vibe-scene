/**
 * Edge & Exit Placement
 * 
 * Implements Phase 5: Edges & Exits.
 * Handles digging exits to the map boundary.
 */

import { CellType } from './models.js';

export class ExitPlacer {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = options;
    }

    placeExits() {
        if (!this.options.peripheralEgress) return;

        // Find potential exit candidates
        // A candidate is a FLOOR cell that is close to the mask boundary 
        // OR close to the grid edge if mask covers it.
        // And we want to dig OUT (away from center) to the edge of the grid.

        // Strategy:
        // iterate along the edges of the grid (with some padding).
        // If we find a floor cell near edge, Good.
        // If not, we find the closest floor cell to the edge?

        // Simpler Strategy:
        // Pick 4 directions (N, S, E, W).
        // Find the "most outlying" floor cells in these directions.
        // Dig from them to the edge.

        const candidates = [];

        // North
        for (let y = 1; y < this.grid.height / 2; y++) {
            for (let x = 1; x < this.grid.width - 1; x++) {
                if (this.grid.get(x, y) === CellType.FLOOR) {
                    // Found top-most floor? Not strictly, as loop order matters.
                    // We want a few.
                }
            }
        }

        // Let's sweep from edges INWARD.
        // North Edge
        this._attemptExit(this.grid.width / 2, 0, 0, 1);
        // South Edge
        this._attemptExit(this.grid.width / 2, this.grid.height - 1, 0, -1);
        // West Edge
        this._attemptExit(0, this.grid.height / 2, 1, 0);
        // East Edge
        this._attemptExit(this.grid.width - 1, this.grid.height / 2, -1, 0);
    }

    _attemptExit(startX, startY, dx, dy) {
        // Raycast from edge inward until we hit Floor
        const w = this.grid.width;
        const h = this.grid.height;

        let cx = Math.floor(startX);
        let cy = Math.floor(startY);

        const maxDist = Math.max(w, h);
        let found = false;
        let hitX, hitY;

        for (let i = 0; i < maxDist; i++) {
            if (cx < 0 || cx >= w || cy < 0 || cy >= h) break;

            if (this.grid.get(cx, cy) === CellType.FLOOR) {
                found = true;
                hitX = cx;
                hitY = cy;
                break;
            }

            cx += dx;
            cy += dy;
        }

        if (found) {
            // Dig back from hit to start
            // Note: startX/Y might be float if we used center, but I passed midpoints.
            // Dig straight line.
            this._digLine(hitX, hitY, Math.floor(startX), Math.floor(startY));
        }
    }

    _digLine(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.grid.set(x0, y0, CellType.FLOOR);
            // Optionally set as 'Exit' cell type or door if needed? 
            // Just Floor is fine for now.

            if ((x0 === x1) && (y0 === y1)) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }
}
