/**
 * Core Data Models for Grid-Based Dungeon Generation
 */

// CellType.DOOR is removed as doors are now objects on edges
export const CellType = {
    EMPTY: 0,
    FLOOR: 1,
    WALL: 2 // Wall might not be explicitly used in grid if we just have empty/floor
};

export class DungeonGrid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Int8Array(width * height).fill(CellType.EMPTY);
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
