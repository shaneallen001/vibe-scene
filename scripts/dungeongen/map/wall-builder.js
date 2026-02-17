/**
 * Wall Builder
 * 
 * Extracts wall segments from the grid for Foundry VTT.
 * Optimizes by merging collinear segments.
 */

import { CellType } from '../layout/models.js';

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
        // Identify all cell edges that should be walls.
        // Vision-blocking walls are placed at the FLOOR/non-FLOOR boundary,
        // i.e. where walkable floor meets the wall band (or empty space).

        // Helper: true only for walkable FLOOR cells (not WALL texture cells)
        const isFloor = (x, y) => this.grid.get(x, y) === CellType.FLOOR;

        // Helper to check if a specific edge is occupied by a door
        const getDoorAt = (x, y, dir) => {
            return this.grid.doors.find(d => d.x === x && d.y === y && d.direction === dir);
        };

        // Scan for Vertical Walls (Left/Right edges of cells)
        // We only need to check the "Right" side of each cell to avoid partial doubles,
        // plus the "Left" side of column 0?
        // Actually, let's just scan all vertical grid lines.
        // Grid width W has W+1 vertical grid lines (0 to W).
        for (let x = 0; x <= this.grid.width; x++) {
            for (let y = 0; y < this.grid.height; y++) {
                const cellLeft = isFloor(x - 1, y);
                const cellRight = isFloor(x, y);

                // Wall exists if boundary between floor and empty
                if (cellLeft !== cellRight) {
                    // Check if this is a door
                    // A vertical door sits at (x,y) and blocks Left-Right.
                    // In our model, a Door object is at a specific cell coordinate.
                    // The door object at (x,y) represents the cell itself being a doorway.
                    // Wait, our previous logic said "Door replaces Floor". 
                    // Let's re-read models.js and doors.js.
                    // DoorPlacer: "grid.doors.push(new Door(x, y, direction))"
                    // And the cell at (x,y) IS Type.FLOOR (it was checked as such).
                    // So a specific cell (x,y) IS the door.

                    // IF cell (x,y) is a door:
                    //   Vertical Door: Blocks L-R movement. It needs walls on its Left and Right?
                    //   No, the door ITSELF is the barrier.

                    // Let's look at the Renderer.
                    // Vertical door (w=thickness, h=cellSize) is drawn in center of cell.
                    // This implies the door is INSIDE the cell, not on the edge.

                    // Foundry Walls/Doors are vectors.
                    // If the cell (x,y) is a Vertical Door, it acts as a wall running down the middle of the cell?
                    // Or on one of the edges?

                    // Usually in grid dungeongen:
                    // If (x,y) is a DOOR cell, we typically put the wall/door segment in the CENTER of the cell, 
                    // or we treat the cell as a connector.

                    // Re-evaluating extraction strategy for Doors:
                    // The "Edge Detection" loop finds walls between Floor and Empty.
                    // Doors are ON Floor cells.
                    // So, we need two passes:

                    // Pass A: Boundary Walls (Edge Logic)
                    // If (x-1,y) is Floor and (x,y) is Empty -> Wall on grid line X, from Y to Y+1.
                    // This is a normal solid wall.

                    // Pass B: Internal Doors (Cell Logic)
                    // Iterate all Door objects.
                    // If Door at (x,y) is Vertical:
                    //   It connects (x-1,y) and (x+1,y).
                    //   We want a Foundry "Door" wall segment.
                    //   Where? Standard practice is either:
                    //   1. Center of cell: (x+0.5, y) to (x+0.5, y+1)
                    //   2. Aligned with grid lines? No, if it's a 1x1 cell, center is best.

                    // Let's stick to the Edge Detection loop for ENCLOSURE walls.
                    // And strictly handle Doors based on the Door list, probably placing them in the center of the cell.

                    // So, inside this loop (x,y), we are just looking for solid walls.
                    // A Door cell is considered "Floor" so it handles boundary correctly (e.g. Door next to Void has a Wall).

                    this.addWallSegment(x, y, x, y + 1, WALL_DOOR_TYPES.NONE);
                }
            }
        }

        // Scan for Horizontal Walls (Top/Bottom edges)
        for (let y = 0; y <= this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cellUp = isFloor(x, y - 1);
                const cellDown = isFloor(x, y);

                if (cellUp !== cellDown) {
                    this.addWallSegment(x, y, x + 1, y, WALL_DOOR_TYPES.NONE);
                }
            }
        }

        // Now add Doors as "Door" walls
        // We place them in the center of the cell to match the visual rendering
        // Vertical Door: (x+0.5, y) to (x+0.5, y+1)
        // Horizontal Door: (x, y+0.5) to (x+1, y+0.5)
        for (const door of this.grid.doors) {
            if (door.direction === 'vertical') {
                // Vertical door in cell (x,y)
                // In rendering, it's a thin rect in center.
                // Foundry wall should be a line down the center.
                this.addWallSegment(door.x + 0.5, door.y, door.x + 0.5, door.y + 1, WALL_DOOR_TYPES.DOOR);
            } else {
                // Horizontal door
                this.addWallSegment(door.x, door.y + 0.5, door.x + 1, door.y + 0.5, WALL_DOOR_TYPES.DOOR);
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

                // Check for overlap or adjacency
                // Tolerance for float math? 
                // Grid coords are usually integers or .5.
                // An epsilon of 0.01 is fine.
                if (Math.abs(current[endCoord] - next[startCoord]) < 0.01) {
                    // Contiguous! Extend current.
                    current[endCoord] = next[endCoord];
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
