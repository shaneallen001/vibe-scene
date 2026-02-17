/**
 * Core Data Models for Grid-Based Dungeon Generation
 */

// CellType.DOOR is removed as doors are now objects on edges
export const CellType = {
    EMPTY: 0,
    FLOOR: 1,
    WALL: 2 // Perimeter cells adjacent to FLOOR — rendered with wall texture
};

export class DungeonGrid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Int8Array(width * height).fill(CellType.EMPTY);
        this.mask = new Int8Array(width * height).fill(0); // 0 = Void, 1 = Valid
        this.rooms = [];
        this.passages = [];
        this.doors = [];

    }

    get(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return CellType.EMPTY;
        return this.data[y * this.width + x];
    }

    set(x, y, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        this.data[y * this.width + x] = value;
    }

    getMask(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
        return this.mask[y * this.width + x];
    }

    setMask(x, y, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        this.mask[y * this.width + x] = value;
    }

    /**
     * Check if a region is valid according to the mask.
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     * @returns {boolean} True if the entire region is within the valid mask
     */
    isRegionValid(x, y, w, h) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (this.getMask(x + dx, y + dy) === 0) return false;
            }
        }
        return true;
    }

    carveRect(x, y, w, h, value = CellType.FLOOR) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.set(x + dx, y + dy, value);
            }
        }
    }

    isRegionEmpty(x, y, w, h) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (this.get(x + dx, y + dy) !== CellType.EMPTY) return false;
            }
        }
        return true;
    }

    /**
     * Mark EMPTY cells adjacent to FLOOR cells as WALL.
     * Creates a visible wall band around rooms and corridors.
     * @param {number} thickness - How many cells deep the wall band extends (default 1)
     */
    carveWallPerimeter(thickness = 1) {
        const toMark = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.get(x, y) !== CellType.EMPTY) continue;
                let shouldMark = false;
                for (let dy = -thickness; dy <= thickness && !shouldMark; dy++) {
                    for (let dx = -thickness; dx <= thickness && !shouldMark; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (this.get(x + dx, y + dy) === CellType.FLOOR) {
                            shouldMark = true;
                        }
                    }
                }
                if (shouldMark) {
                    toMark.push(x, y);
                }
            }
        }
        for (let i = 0; i < toMark.length; i += 2) {
            this.set(toMark[i], toMark[i + 1], CellType.WALL);
        }
    }

    /**
     * Get valid neighbors for a cell
     * @returns {Array} List of {x, y, value}
     */
    getNeighbors(x, y) {
        const neighbors = [];
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                neighbors.push({ x: nx, y: ny, value: this.get(nx, ny) });
            }
        }
        return neighbors;
    }
}

export class Room {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.id = crypto.randomUUID();
        this.connections = []; // List of connected room IDs
    }

    get center() {
        return {
            x: Math.floor(this.x + this.width / 2),
            y: Math.floor(this.y + this.height / 2)
        };
    }
}

export class Door {
    constructor(x, y, direction = 'vertical') {
        this.x = x;
        this.y = y;
        this.direction = direction; // 'vertical' (blocks Left-Right) or 'horizontal' (blocks Top-Bottom)
        this.id = crypto.randomUUID();
    }
}


