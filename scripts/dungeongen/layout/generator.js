/**
 * Grid-Based Dungeon Generator
 * 
 * Generates dungeons by painting cells onto a grid.
 */

import { DungeonGrid, CellType, Room, Door } from './models.js';

export class DungeonGenerator {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        this.options = options;
        // Initialize grid
        this.grid = new DungeonGrid(width, height);
    }

    generate() {
        // Phase 1: Place Rooms with explicit buffer
        this._placeRooms();

        // Phase 2: Connect Rooms (MST) & Route Passages using A*
        this._connectRooms();

        // Phase 3: Place Doors (explicitly at room entries)
        this._placeDoors();

        return this.grid;
    }

    _placeRooms() {
        const numRooms = this.options.numRooms || 10;
        const minSize = this.options.minRoomSize || 6;
        const maxSize = this.options.maxRoomSize || 12; // Reduced max size slightly to allow more space

        // Try to place rooms
        let attempts = 0;
        const maxAttempts = numRooms * 20;

        while (this.grid.rooms.length < numRooms && attempts < maxAttempts) {
            attempts++;

            const w = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const h = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;

            // Ensure we don't go out of bounds (padding of 2 for walls + buffer)
            const x = Math.floor(Math.random() * (this.width - w - 4)) + 2;
            const y = Math.floor(Math.random() * (this.height - h - 4)) + 2;

            // Check if region is empty including a 1-cell buffer around it
            // This ensures at least 1 cell of wall between rooms
            if (this.grid.isRegionEmpty(x - 1, y - 1, w + 2, h + 2)) {
                this.grid.carveRect(x, y, w, h, CellType.FLOOR);
                const room = new Room(x, y, w, h);
                this.grid.rooms.push(room);
            }
        }
    }

    _connectRooms() {
        const rooms = this.grid.rooms;
        if (rooms.length < 2) return;

        const edges = [];
        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                const r1 = rooms[i];
                const r2 = rooms[j];
                const c1 = r1.center;
                const c2 = r2.center;
                const dist = Math.abs(c1.x - c2.x) + Math.abs(c1.y - c2.y);
                edges.push({ u: i, v: j, w: dist });
            }
        }
        edges.sort((a, b) => a.w - b.w);

        const parent = Array.from({ length: rooms.length }, (_, i) => i);
        function find(i) {
            if (parent[i] === i) return i;
            return parent[i] = find(parent[i]);
        }
        function union(i, j) {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) {
                parent[rootI] = rootJ;
                return true;
            }
            return false;
        }

        // Add MST edges
        for (const edge of edges) {
            if (union(edge.u, edge.v)) {
                this._routePassageAStar(rooms[edge.u], rooms[edge.v]);
            }
        }

        // Add a few loop edges
        let loopsAdded = 0;
        for (const edge of edges) {
            if (loopsAdded >= 2) break;
            if (find(edge.u) === find(edge.v)) {
                if (Math.random() < 0.1) {
                    this._routePassageAStar(rooms[edge.u], rooms[edge.v]);
                    loopsAdded++;
                }
            }
        }
    }

    _routePassageAStar(r1, r2) {
        const start = r1.center;
        const end = r2.center;

        // A* Pathfinding
        const frontier = new TinyQueue([{ x: start.x, y: start.y, priority: 0 }], (a, b) => a.priority - b.priority);
        const cameFrom = new Map();
        const costSoFar = new Map();
        const startKey = `${start.x},${start.y}`;

        cameFrom.set(startKey, null);
        costSoFar.set(startKey, 0);

        let current = null;
        let found = false;

        while (frontier.length > 0) {
            current = frontier.pop();

            // Reached destination room interior?
            // Actually, we want to reach center, but hitting any point in target room is fine?
            // Let's stick to center for now to ensure we punch through.
            if (current.x === end.x && current.y === end.y) {
                found = true;
                break;
            }

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const next of neighbors) {
                if (next.x <= 0 || next.x >= this.width - 1 || next.y <= 0 || next.y >= this.height - 1) continue;

                const newCost = (costSoFar.get(`${current.x},${current.y}`) || 0) + this._getMovementCost(next.x, next.y, r1, r2);
                const nextKey = `${next.x},${next.y}`;

                if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                    costSoFar.set(nextKey, newCost);
                    const priority = newCost + Math.abs(end.x - next.x) + Math.abs(end.y - next.y); // Heuristic
                    frontier.push({ x: next.x, y: next.y, priority });
                    cameFrom.set(nextKey, current);
                }
            }
        }

        if (found) {
            // Retrace path
            let curr = current;
            while (curr) {
                this.grid.set(curr.x, curr.y, CellType.FLOOR);
                const key = `${curr.x},${curr.y}`;
                const prev = cameFrom.get(key);
                if (!prev) break;
                curr = prev;
            }
        } else {
            // Fallback to L-shape if A* fails (rare)
            this._routePassage(r1, r2);
        }
    }

    _getMovementCost(x, y, r1, r2) {
        // Base cost
        let cost = 1;

        const cell = this.grid.get(x, y);

        // Prefer existing floors
        if (cell === CellType.FLOOR) {
            cost = 1;
        } else {
            cost = 5; // Digging new tunnel is slightly more expensive
        }

        // HEAVY penalty for being adjacent to a room that isn't the start or end room
        // This creates the "buffer" effect for hallways
        if (this._isAdjacentToOtherRoom(x, y, r1, r2)) {
            cost += 50;
        }

        return cost;
    }

    _isAdjacentToOtherRoom(x, y, r1, r2) {
        for (const room of this.grid.rooms) {
            if (room === r1 || room === r2) continue; // It's okay to be near start/end rooms
            // Check expansion (room borders + 1)
            if (x >= room.x - 1 && x <= room.x + room.width &&
                y >= room.y - 1 && y <= room.y + room.height) {
                return true;
            }
        }
        return false;
    }

    // Fallback L-shaped routing
    _routePassage(r1, r2) {
        const c1 = r1.center;
        const c2 = r2.center;
        if (Math.random() < 0.5) {
            this._carveH(c1.x, c2.x, c1.y);
            this._carveV(c1.y, c2.y, c2.x);
        } else {
            this._carveV(c1.y, c2.y, c1.x);
            this._carveH(c1.x, c2.x, c2.y);
        }
    }
    _carveH(x1, x2, y) {
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        for (let x = start; x <= end; x++) this.grid.set(x, y, CellType.FLOOR);
    }

    _carveV(y1, y2, x) {
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        for (let y = start; y <= end; y++) this.grid.set(x, y, CellType.FLOOR);
    }


    _placeDoors() {
        // Identify potential door locations:
        // A floor cell that has exactly two FLOOR neighbors (opposite sides)
        // AND one of those neighbors is in a room and the other is NOT (hallway)
        // OR both are in different rooms (direct adjacent rooms, though _placeRooms avoids this usually)

        this.grid.doors = []; // Reset doors

        // Iterate over all rooms to find their entry points
        // Doing it this way ensures we look at boundaries

        // BETTER STRATEGY: 
        // Iterate every cell. If it is a FLOOR cell, check if it qualifies as a door.
        // A Door Candidate is:
        // 1. A FLOOR cell
        // 2. Is effectively a "connector" (narrow point)
        // 3. Connects a room to something else (hallway or another room)

        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (this.grid.get(x, y) !== CellType.FLOOR) continue;

                // Check neighbors
                const n = this.grid.get(x, y - 1) === CellType.FLOOR;
                const s = this.grid.get(x, y + 1) === CellType.FLOOR;
                const e = this.grid.get(x + 1, y) === CellType.FLOOR;
                const w = this.grid.get(x - 1, y) === CellType.FLOOR;

                let isVerticalDoor = w && e && !n && !s; // Corridor runs Left-Right
                let isHorizontalDoor = n && s && !w && !e; // Corridor runs Top-Bottom

                if (!isVerticalDoor && !isHorizontalDoor) continue;

                // Now check room connectivity
                // For a vertical door (running left-right), check if left is room and right is hallway, or vice versa
                // Actually, simplest check: Am I inside a room definition?
                const myRoom = this._getRoomAt(x, y);
                if (myRoom) continue; // Don't place doors INSIDE rooms

                // So I am a hallway cell.
                // Do I connect to a room?
                let connectsToRoom = false;

                if (isVerticalDoor) {
                    if (this._getRoomAt(x - 1, y) || this._getRoomAt(x + 1, y)) connectsToRoom = true;
                } else {
                    if (this._getRoomAt(x, y - 1) || this._getRoomAt(x, y + 1)) connectsToRoom = true;
                }

                if (connectsToRoom) {
                    // Determine direction for the door object (visuals)
                    // If corridor is Left-Right (Vertical Door), we want the door to block the path?
                    // Wait, 'direction' in models.js was 'vertical' (right edge) or 'horizontal' (bottom edge).
                    // But now we are the cell itself.
                    // Let's redefine direction:
                    // 'vertical' = door stands vertically (blocking left-right movement) -> |
                    // 'horizontal' = door stands horizontally (blocking up-down movement) -> -

                    // If I am a connector moving Left-Right (neighbors West/East), I need a Vertical door (|) to block it.
                    const dir = isVerticalDoor ? 'vertical' : 'horizontal';

                    // Avoid double doors (if neighbor is also a door)
                    const hasDoorNeighbor = this.grid.doors.some(d => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
                    if (!hasDoorNeighbor) {
                        this.grid.doors.push(new Door(x, y, dir));
                    }
                }
            }
        }
    }

    _getRoomAt(x, y) {
        return this.grid.rooms.find(r =>
            x >= r.x && x < r.x + r.width &&
            y >= r.y && y < r.y + r.height
        );
    }
}

// Simple Priority Queue for A*
class TinyQueue {
    constructor(data = [], compare = (a, b) => a - b) {
        this.data = data;
        this.compare = compare;
        this.length = data.length;
        if (this.length > 0) {
            for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);
        }
    }
    push(item) {
        this.data.push(item);
        this.length++;
        this._up(this.length - 1);
    }
    pop() {
        if (this.length === 0) return undefined;
        const top = this.data[0];
        const bottom = this.data.pop();
        this.length--;
        if (this.length > 0) {
            this.data[0] = bottom;
            this._down(0);
        }
        return top;
    }
    peek() { return this.data[0]; }
    _up(pos) {
        const { data, compare } = this;
        const item = data[pos];
        while (pos > 0) {
            const parent = (pos - 1) >> 1;
            const current = data[parent];
            if (compare(item, current) >= 0) break;
            data[pos] = current;
            pos = parent;
        }
        data[pos] = item;
    }
    _down(pos) {
        const { data, compare } = this;
        const halfLength = this.length >> 1;
        const item = data[pos];
        while (pos < halfLength) {
            let bestChild = (pos << 1) + 1;
            const right = bestChild + 1;
            if (right < this.length && compare(data[right], data[bestChild]) < 0) {
                bestChild = right;
            }
            if (compare(data[bestChild], item) >= 0) break;
            data[pos] = data[bestChild];
            pos = bestChild;
        }
        data[pos] = item;
    }
}

