/**
 * Wall Builder
 * 
 * Extracts wall segments from the grid for Foundry VTT.
 * Optimizes by merging collinear segments.
 *
 * Wall Offset ("kicked-out walls"):
 *   Vision-blocking walls are pushed outward from the FLOOR/non-FLOOR boundary
 *   by WALL_OUTSET (1/3 cell) so that players can see the textured wall band
 *   from inside rooms. Doors are widened accordingly to span the larger opening.
 */

import { CellType } from '../layout/models.js';

// How far (in grid-cell fractions) to push walls outward into the wall band.
// 1/3 of a cell lets players see wall textures without exposing too much.
const WALL_OUTSET = 1 / 3;

// Foundry VTT Constants (replicated here to avoid dependency on global user constants in node env)
const WALL_DOOR_TYPES = {
    NONE: 0,
    DOOR: 1,
    SECRET: 2
};

const WALL_DOOR_STATES = {
    CLOSED: 0,
    OPEN: 1,
    LOCKED: 2
};

const WALL_SENSE_TYPES = {
    NONE: 0,
    LIMITED: 10,
    NORMAL: 20
};

const WALL_MOVEMENT_TYPES = {
    NONE: 0,
    NORMAL: 20
};

const WALL_SOUND_TYPES = {
    NONE: 0,
    NORMAL: 20
};

export class WallBuilder {
    /**
     * Build wall data for the given grid
     * @param {DungeonGrid} grid 
     * @param {number} cellSize - Pixels per grid cell
     * @param {number} padding - Padding in pixels (offsetX and offsetY)
     * @returns {Array<Object>} Array of WallDocument data
     */
    static build(grid, cellSize, padding) {
        const builder = new WallBuilder(grid, cellSize, padding);
        return builder.build();
    }

    constructor(grid, cellSize, padding) {
        this.grid = grid;
        this.cellSize = cellSize;
        this.padding = padding;
        this.walls = []; // Array of {x1, y1, x2, y2, type} in grid coords
    }

    build() {
        // 1. Extract raw segments from grid edges
        this._extractSegments();

        // 2. Merge collinear segments
        this._mergeSegments();

        // 3. Convert to Foundry data
        return this.walls.map(w => this._toWallData(w));
    }

    _extractSegments() {
        // Vision-blocking walls are pushed outward from the FLOOR/non-FLOOR
        // boundary by WALL_OUTSET so players can see the textured wall band.
        //
        // Each 1-cell edge segment is shifted perpendicular to itself (away from
        // the floor side). Its two endpoints are then conditionally extended by
        // WALL_OUTSET so that it meets the perpendicular pushed-out wall at that
        // corner — but ONLY when such a perpendicular wall actually exists there.
        // This prevents "horns" at convex corners and gaps at concave ones.

        const isFloor = (x, y) => this.grid.get(x, y) === CellType.FLOOR;
        const outset = WALL_OUTSET;

        // Pre-compute which edges are boundaries so we can look up neighbours.
        // vEdge[x][y] = true  means the vertical grid-line at x between
        //   cells (x-1,y) and (x,y) is a floor/non-floor boundary.
        // hEdge[x][y] = true  means the horizontal grid-line at y between
        //   cells (x,y-1) and (x,y) is a floor/non-floor boundary.
        const W = this.grid.width;
        const H = this.grid.height;

        const vEdge = Array.from({ length: W + 1 }, () => new Uint8Array(H));
        const hEdge = Array.from({ length: W }, () => new Uint8Array(H + 1));

        for (let x = 0; x <= W; x++)
            for (let y = 0; y < H; y++)
                if (isFloor(x - 1, y) !== isFloor(x, y)) vEdge[x][y] = 1;

        for (let y = 0; y <= H; y++)
            for (let x = 0; x < W; x++)
                if (isFloor(x, y - 1) !== isFloor(x, y)) hEdge[x][y] = 1;

        // --- Vertical boundary walls ---
        // A vertical edge at grid-line x, cell-row y separates (x-1,y) and (x,y).
        // It is pushed toward the non-floor side by outset.
        //
        // At each endpoint we extend by outset if a perpendicular (horizontal)
        // boundary edge meets at that corner AND its pushed-out position would
        // intersect this wall's pushed-out position. This happens in two cases:
        //
        //   Convex corner (outside turn): the perpendicular edge is on the
        //     floor-side column → both walls push outward in the same "away
        //     from floor" direction and meet at the outset corner.
        //
        //   Concave corner (inside turn): the perpendicular edge is on the
        //     non-floor-side column → the perpendicular wall is pushed toward
        //     this wall (they converge) and also meet at the outset corner.
        //
        // We check BOTH columns; if either has a horizontal boundary we extend.
        for (let x = 0; x <= W; x++) {
            for (let y = 0; y < H; y++) {
                if (!vEdge[x][y]) continue;
                const floorL = isFloor(x - 1, y);

                const wx = floorL ? x + outset : x - outset;

                // Top end (grid-line y)
                let y1 = y;
                const hTopFloor = (floorL ? hEdge[x - 1]?.[y] : hEdge[x]?.[y]) || 0;
                const hTopNon   = (floorL ? hEdge[x]?.[y]     : hEdge[x - 1]?.[y]) || 0;
                if (hTopFloor || hTopNon) y1 -= outset;

                // Bottom end (grid-line y+1)
                let y2 = y + 1;
                const hBotFloor = (floorL ? hEdge[x - 1]?.[y + 1] : hEdge[x]?.[y + 1]) || 0;
                const hBotNon   = (floorL ? hEdge[x]?.[y + 1]     : hEdge[x - 1]?.[y + 1]) || 0;
                if (hBotFloor || hBotNon) y2 += outset;

                this.addWallSegment(wx, y1, wx, y2, WALL_DOOR_TYPES.NONE);
            }
        }

        // --- Horizontal boundary walls ---
        for (let y = 0; y <= H; y++) {
            for (let x = 0; x < W; x++) {
                if (!hEdge[x][y]) continue;
                const floorU = isFloor(x, y - 1);

                const wy = floorU ? y + outset : y - outset;

                // Left end (grid-line x)
                let x1 = x;
                const vLeftFloor = (floorU ? vEdge[x]?.[y - 1] : vEdge[x]?.[y]) || 0;
                const vLeftNon   = (floorU ? vEdge[x]?.[y]     : vEdge[x]?.[y - 1]) || 0;
                if (vLeftFloor || vLeftNon) x1 -= outset;

                // Right end (grid-line x+1)
                let x2 = x + 1;
                const vRightFloor = (floorU ? vEdge[x + 1]?.[y - 1] : vEdge[x + 1]?.[y]) || 0;
                const vRightNon   = (floorU ? vEdge[x + 1]?.[y]     : vEdge[x + 1]?.[y - 1]) || 0;
                if (vRightFloor || vRightNon) x2 += outset;

                this.addWallSegment(x1, wy, x2, wy, WALL_DOOR_TYPES.NONE);
            }
        }

        // --- Doors ---
        // Doors span the full pushed-out wall gap (1 cell + outset on each end).
        for (const door of this.grid.doors) {
            if (door.direction === 'vertical') {
                this.addWallSegment(
                    door.x + 0.5, door.y - outset,
                    door.x + 0.5, door.y + 1 + outset,
                    WALL_DOOR_TYPES.DOOR
                );
            } else {
                this.addWallSegment(
                    door.x - outset, door.y + 0.5,
                    door.x + 1 + outset, door.y + 0.5,
                    WALL_DOOR_TYPES.DOOR
                );
            }
        }
    }

    addWallSegment(x1, y1, x2, y2, type) {
        // We can just push to array and let merge handle it.
        // Or strictly separate "Edge Walls" vs "Door Walls" to avoid merging a door into a wall (bad).
        // My merge logic will split by type/alignment anyway.
        this.walls.push({ x1, y1, x2, y2, type });
    }

    _mergeSegments() {
        // Sort walls to make merging easier
        // We separate vertical vs horizontal, and also by type.

        const horizontal = [];
        const vertical = [];
        const others = []; // Slanted or weird ones (shouldn't exist here but good practice)

        for (const w of this.walls) {
            if (w.y1 === w.y2) horizontal.push(w);
            else if (w.x1 === w.x2) vertical.push(w);
            else others.push(w);
        }

        // Merge Horizontal
        // Group by Y, then Type. Then sort by X.
        const mergedHorizontal = this._mergeLinear(horizontal, 'y1', 'type', 'x1', 'x2'); // primary, secondary, sortPos, endPos

        // Merge Vertical
        // Group by X, then Type. Then sort by Y.
        const mergedVertical = this._mergeLinear(vertical, 'x1', 'type', 'y1', 'y2');

        this.walls = [...mergedHorizontal, ...mergedVertical, ...others];
    }

    _mergeLinear(segments, commonCoord, typeProp, startCoord, endCoord) {
        if (segments.length === 0) return [];

        // 1. Group keys: e.g. "y=5,type=0"
        const groups = new Map();

        for (const s of segments) {
            // Get value of common coord (e.g. y=5)
            // Note: coordinates might be 5.5 for doors/center walls
            const key = `${s[commonCoord]}_${s[typeProp]}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(s);
        }

        const result = [];

        // 2. Process each group
        for (const group of groups.values()) {
            // Sort by start position
            group.sort((a, b) => a[startCoord] - b[startCoord]);

            let current = group[0];

            for (let i = 1; i < group.length; i++) {
                const next = group[i];

                // Merge if segments are contiguous or overlapping (within tolerance).
                // With wall outset, adjacent segments overlap by 2*WALL_OUTSET.
                if (next[startCoord] <= current[endCoord] + 0.01) {
                    // Extend current to the farther end
                    current[endCoord] = Math.max(current[endCoord], next[endCoord]);
                } else {
                    // Gap found. Push current and start new.
                    result.push(current);
                    current = next;
                }
            }
            result.push(current);
        }

        return result;
    }

    _toWallData(w) {
        // Convert grid coords to pixel coords
        // pixel = padding + coord * cellSize
        const c = [
            this.padding + w.x1 * this.cellSize,
            this.padding + w.y1 * this.cellSize,
            this.padding + w.x2 * this.cellSize,
            this.padding + w.y2 * this.cellSize
        ];

        const data = {
            c,
            move: WALL_MOVEMENT_TYPES.NORMAL,
            sight: WALL_SENSE_TYPES.NORMAL,
            sound: WALL_SOUND_TYPES.NORMAL,
            door: w.type,
            dir: 0 // Both directions
        };

        if (w.type === WALL_DOOR_TYPES.DOOR) {
            data.ds = WALL_DOOR_STATES.CLOSED;
        }

        return data;
    }
}
