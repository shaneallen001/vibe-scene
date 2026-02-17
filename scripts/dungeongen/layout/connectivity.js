/**
 * Connectivity & Corridor Routing
 * 
 * Implements Phase 3: Intelligent Corridors.
 * Handles MST generation, loop addition, and varied path carving.
 */

import { CellType } from './models.js';

export const ConnectivityStrategy = {
    MST: 'mst',
    MST_LOOPS: 'mst_loops',
    FULL: 'full', // Connect everyone to everyone (chaos!)
    NEAREST: 'nearest' // Chain logic
};

export const CorridorStyle = {
    STRAIGHT: 'straight',
    L_PATH: 'l_path',
    ERRANT: 'errant', // Wandering A*
    LABYRINTH: 'labyrinth' // Maze fill (future)
};

export class NetworkConnector {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = options;
        this.strategy = options.connectivity || ConnectivityStrategy.MST_LOOPS;
        this.style = options.corridorStyle || CorridorStyle.L_PATH;
    }

    connectRooms() {
        if (this.grid.rooms.length < 2) return;

        // 1. Generate Graph Edges
        const edges = this._generateEdges();

        // 2. Select Edges based on Strategy
        const selectedEdges = this._selectEdges(edges);

        // 3. Carve Corridors
        for (const edge of selectedEdges) {
            const r1 = this.grid.rooms[edge.u];
            const r2 = this.grid.rooms[edge.v];

            // Store connectivity in room objects for AI context
            r1.connections.push(r2.id);
            r2.connections.push(r1.id);

            this._routePassage(r1, r2);
        }
    }

    /**
     * Connect specific room pairs from an outline.
     * @param {Array} roomPairs - [{from, to}]
     */
    connectSpecificRooms(roomPairs = []) {
        if (this.grid.rooms.length < 2 || !Array.isArray(roomPairs) || roomPairs.length === 0) return 0;
        const byId = new Map(this.grid.rooms.map(room => [String(room.id), room]));
        const seen = new Set();
        let connectedCount = 0;

        for (const pair of roomPairs) {
            const fromId = String(pair?.from || '').trim();
            const toId = String(pair?.to || '').trim();
            if (!fromId || !toId || fromId === toId) continue;
            const key = fromId < toId ? `${fromId}::${toId}` : `${toId}::${fromId}`;
            if (seen.has(key)) continue;

            const r1 = byId.get(fromId);
            const r2 = byId.get(toId);
            if (!r1 || !r2) continue;

            if (!r1.connections.includes(r2.id)) r1.connections.push(r2.id);
            if (!r2.connections.includes(r1.id)) r2.connections.push(r1.id);
            this._routePassage(r1, r2);
            seen.add(key);
            connectedCount += 1;
        }
        return connectedCount;
    }

    _generateEdges() {
        const rooms = this.grid.rooms;
        const edges = [];
        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                const r1 = rooms[i];
                const r2 = rooms[j];
                const c1 = r1.center;
                const c2 = r2.center;
                // Manhattan distance usually better for grid
                const dist = Math.abs(c1.x - c2.x) + Math.abs(c1.y - c2.y);
                edges.push({ u: i, v: j, w: dist });
            }
        }
        return edges.sort((a, b) => a.w - b.w);
    }

    _selectEdges(allEdges) {
        const rooms = this.grid.rooms;
        const selected = [];

        // Union-Find data structure
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

        // MST logic
        for (const edge of allEdges) {
            if (union(edge.u, edge.v)) {
                selected.push(edge);
            }
        }

        // Add Loops?
        if (this.strategy === ConnectivityStrategy.MST_LOOPS || this.strategy === ConnectivityStrategy.FULL) {
            // Re-check all edges. If u and v already connected, it's a loop.
            // For 'mst_loops', add a few. For 'full', add all (probably don't want full full).

            let loopsAdded = 0;
            const maxLoops = Math.max(2, Math.floor(rooms.length * 0.2)); // 20% extra edges

            for (const edge of allEdges) {
                // If this edge was NOT selected for MST (meaning it connects two already connected nodes)
                if (!selected.includes(edge)) {
                    if (this.strategy === ConnectivityStrategy.FULL) {
                        selected.push(edge);
                    } else if (loopsAdded < maxLoops) {
                        // Chance to add loop, prioritizing short edges (list is sorted)
                        // But maybe we want some long loops?
                        // Let's just take the next best edges that form loops.
                        if (Math.random() < 0.3) {
                            selected.push(edge);
                            loopsAdded++;
                        }
                    }
                }
            }
        }

        return selected;
    }

    _routePassage(r1, r2) {
        const c1 = r1.center;
        const c2 = r2.center;

        switch (this.style) {
            case CorridorStyle.STRAIGHT:
                // Bresenham or simple line
                // But Bresenham might look jagged. 
                // Let's use L-Path logic but try to be as straight as possible? 
                // No, 'straight' in grid usually implies diagonal steps or clean lines.
                // Let's implement a "dig straight" logic.
                this._digLine(c1.x, c1.y, c2.x, c2.y);
                break;

            case CorridorStyle.ERRANT:
                this._routePassageAStar(r1, r2, 0.2); // Low randomness
                break;

            case CorridorStyle.L_PATH:
            default:
                if (Math.random() < 0.5) {
                    this._carveH(c1.x, c2.x, c1.y);
                    this._carveV(c1.y, c2.y, c2.x);
                } else {
                    this._carveV(c1.y, c2.y, c1.x);
                    this._carveH(c1.x, c2.x, c2.y);
                }
                break;
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

    _digLine(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.grid.set(x0, y0, CellType.FLOOR);
            if ((x0 === x1) && (y0 === y1)) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    _routePassageAStar(r1, r2, noiseFactor = 0) {
        const start = r1.center;
        const end = r2.center;

        // A* with optional noise
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
                // Bounds check
                if (next.x <= 0 || next.x >= this.grid.width - 1 || next.y <= 0 || next.y >= this.grid.height - 1) continue;

                // Check Mask? Corridors should ideally stay in valid mask, but maybe can tunnel?
                // Let's strictly enforce mask.
                if (!this.grid.isRegionValid(next.x, next.y, 1, 1)) continue;

                // Cost function
                let newCost = costSoFar.get(`${current.x},${current.y}`) || 0;

                // Base cost
                let stepCost = 1;

                // Bias against digging new rock vs existing floor
                if (this.grid.get(next.x, next.y) !== CellType.FLOOR) {
                    stepCost = 5; // Digging cost
                }

                // Add randomness for 'Errant' feel
                if (noiseFactor > 0) {
                    stepCost += Math.random() * noiseFactor * 10;
                }

                newCost += stepCost;

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
            // Retrace
            let curr = current;
            while (curr) {
                this.grid.set(curr.x, curr.y, CellType.FLOOR);
                const key = `${curr.x},${curr.y}`;
                const prev = cameFrom.get(key);
                if (!prev) break;
                curr = prev;
            }
        } else {
            // Fallback
            this._carveH(start.x, end.x, start.y);
            this._carveV(start.y, end.y, end.x);
        }
    }
}

// Embedded TinyQueue for self-containment (or import if extracted)
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

/**
 * Prune dead ends from the grid.
 * @param {DungeonGrid} grid 
 * @param {Object} options 
 * @param {string} options.deadEndRemoval - 'none', 'some', 'all'
 */
export function pruneDeadEnds(grid, options) {
    const removalType = options.deadEndRemoval || 'none';
    if (removalType === 'none') return;

    let removed = true;
    while (removed) {
        removed = false;

        // Find all dead ends (FLOOR cells with 1 FLOOR neighbor)
        for (let y = 1; y < grid.height - 1; y++) {
            for (let x = 1; x < grid.width - 1; x++) {
                if (grid.get(x, y) !== CellType.FLOOR) continue;

                // Count neighbors
                let neighbors = 0;
                if (grid.get(x, y - 1) === CellType.FLOOR) neighbors++;
                if (grid.get(x, y + 1) === CellType.FLOOR) neighbors++;
                if (grid.get(x - 1, y) === CellType.FLOOR) neighbors++;
                if (grid.get(x + 1, y) === CellType.FLOOR) neighbors++;

                if (neighbors <= 1) {
                    // It's a dead end (or isolated point)
                    // Logic for removal:
                    // If 'all': remove it.
                    // If 'some': remove with probability (runs once per cell per pass? might cascade)
                    // The 'donjon' logic usually is:
                    // 100% chance -> remove all dead ends (recursively).
                    // 50% chance -> remove 50% of dead ends (but not recursively in the same way? or just 50% of the tips?)

                    let shouldRemove = false;
                    if (removalType === 'all') {
                        shouldRemove = true;
                    } else if (removalType === 'some') {
                        // For 'some', we want to prune *some* chains.
                        // If we use random per cell in loop, it might prune a whole chain if we are lucky/unlucky.
                        // Standard practice: Assign a "survival ID" to chains? 
                        // Simpler: Just 50% chance to remove this specific tip. 
                        // If we remove it, the next one becomes a tip.
                        if (Math.random() < 0.5) shouldRemove = true;
                    }

                    if (shouldRemove) {
                        grid.set(x, y, CellType.EMPTY); // Fill in
                        removed = true;
                    }
                }
            }
        }

        // If 'some', we might only want one pass? 
        // Or if we want to prune partial chains, we assume the 'random' check happens at every step.
        // Donjon says "Remove Dead Ends: Some" -> reduces maze-iness but keeps some.
        // If we iterate until no dead ends (removed=true loop), 'some' with 0.5 will eventually remove almost everything 
        // because a long chain has many 50% chances to be eaten.
        // So for 'some', we should probably run a fixed number of passes or just one pass?
        // Let's do a designated pass count for 'some' to prune *short* dead ends or shorten long ones.
        if (removalType === 'some') {
            // Only try a limited number of "eats"
            // Actually, simply breaking the 'while(removed)' loop after 1 pass for 'some' 
            // is a good approximation of "remove tips but don't eat whole long corridors".
            removed = false;
        }
    }
}
