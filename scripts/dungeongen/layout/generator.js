/**
 * Dungeon Layout Generator
 * 
 * Main procedural dungeon generator.
 * Ported from dungeongen Python generator.
 */

import { Room, Passage, Door, Exit, Dungeon, RoomShape, DoorType, ExitType } from './models.js';
import { GenerationParams, SymmetryType } from './params.js';

/**
 * Seeded random number generator (LCG)
 */
class SeededRandom {
    constructor(seed = Date.now()) {
        this.seed = seed >>> 0;
    }

    /**
     * Get next random number (0-1)
     */
    random() {
        this.seed = (this.seed * 1103515245 + 12345) >>> 0;
        return (this.seed & 0x7fffffff) / 0x7fffffff;
    }

    /**
     * Random integer in range [min, max] inclusive
     */
    randInt(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    /**
     * Random float in range [min, max]
     */
    randFloat(min, max) {
        return min + this.random() * (max - min);
    }

    /**
     * Random element from array
     */
    choice(arr) {
        return arr[Math.floor(this.random() * arr.length)];
    }

    /**
     * Shuffle array in place
     */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

/**
 * Occupancy grid for collision detection
 */
class OccupancyGrid {
    constructor(size = 200) {
        this.size = size;
        this.offset = Math.floor(size / 2);
        this.grid = new Int8Array(size * size);
    }

    clear() {
        this.grid.fill(0);
    }

    /**
     * Get cell value
     */
    get(x, y) {
        const gx = x + this.offset;
        const gy = y + this.offset;
        if (gx < 0 || gx >= this.size || gy < 0 || gy >= this.size) {
            return -1; // Out of bounds treated as occupied
        }
        return this.grid[gy * this.size + gx];
    }

    /**
     * Set cell value
     */
    set(x, y, value = 1) {
        const gx = x + this.offset;
        const gy = y + this.offset;
        if (gx >= 0 && gx < this.size && gy >= 0 && gy < this.size) {
            this.grid[gy * this.size + gx] = value;
        }
    }

    /**
     * Mark a rectangular region
     */
    markRect(x, y, width, height, value = 1) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                this.set(x + dx, y + dy, value);
            }
        }
    }

    /**
     * Check if a rectangular region is empty
     */
    isRectEmpty(x, y, width, height, margin = 1) {
        for (let dy = -margin; dy < height + margin; dy++) {
            for (let dx = -margin; dx < width + margin; dx++) {
                if (this.get(x + dx, y + dy) !== 0) {
                    return false;
                }
            }
        }
        return true;
    }
}

/**
 * Main dungeon generator
 */
export class DungeonGenerator {
    constructor(params = null) {
        this.params = params || new GenerationParams();
        this.rng = new SeededRandom();
        this.occupancy = new OccupancyGrid();
        this._connectedPairs = new Map();
        this._mirrorPairs = new Map();
    }

    /**
     * Generate a complete dungeon
     */
    generate(seed = null) {
        // Setup RNG
        if (seed !== null) {
            this.rng = new SeededRandom(seed);
        } else if (this.params.seed !== null) {
            this.rng = new SeededRandom(this.params.seed);
        } else {
            this.rng = new SeededRandom(Date.now());
        }

        const dungeon = new Dungeon(seed || Date.now());
        this.occupancy.clear();
        this._connectedPairs.clear();
        this._mirrorPairs.clear();

        // Phase 1: Place rooms
        this._placeRooms(dungeon);

        // Phase 2: Connect rooms with passages
        this._connectRooms(dungeon);

        // Phase 3: Add extra connections (Jaquaying)
        this._addExtraConnections(dungeon);

        // Phase 4: Generate doors
        this._generateDoors(dungeon);

        // Phase 5: Generate exits
        this._generateExits(dungeon);

        // Phase 6: Number rooms
        this._numberRooms(dungeon);

        // Store symmetry info
        dungeon.mirrorPairs = Object.fromEntries(this._mirrorPairs);
        dungeon.propsSeed = this.rng.randInt(0, 0x7fffffff);

        return dungeon;
    }

    /**
     * Place rooms based on symmetry type
     */
    _placeRooms(dungeon) {
        if (this.params.symmetry === SymmetryType.BILATERAL) {
            this._placeRoomsBilateral(dungeon);
        } else {
            this._placeRoomsAsymmetric(dungeon);
        }
    }

    /**
     * Place rooms asymmetrically
     */
    _placeRoomsAsymmetric(dungeon) {
        const [minCount, maxCount] = this.params.getRoomCountRange();
        const targetCount = this.rng.randInt(minCount, maxCount);
        const templates = this.params.getRoomTemplates();

        // Place first room at center
        const firstTemplate = this.rng.choice(templates);
        const firstRoom = new Room({
            x: -Math.floor(firstTemplate[0] / 2),
            y: -Math.floor(firstTemplate[1] / 2),
            width: firstTemplate[0],
            height: firstTemplate[1]
        });
        dungeon.addRoom(firstRoom);
        this._markRoom(firstRoom);

        // Place remaining rooms
        let attempts = 0;
        const maxAttempts = targetCount * 50;

        while (dungeon.rooms.length < targetCount && attempts < maxAttempts) {
            attempts++;

            // Pick a random existing room to branch from
            const anchor = this.rng.choice(dungeon.rooms);

            // Pick random direction
            const direction = this.rng.choice(['north', 'south', 'east', 'west']);

            // Create new room
            const template = this.rng.choice(templates);
            const newRoom = new Room({
                width: template[0],
                height: template[1]
            });

            // Try to place adjacent
            if (this._placeRoomAdjacent(anchor, direction, newRoom, dungeon)) {
                // Success - room was placed and marked
            }
        }
    }

    /**
     * Place rooms with bilateral symmetry
     */
    _placeRoomsBilateral(dungeon) {
        const [minCount, maxCount] = this.params.getRoomCountRange();
        const targetCount = this.rng.randInt(minCount, maxCount);
        const templates = this.params.getRoomTemplates();

        dungeon.spineDirection = 'south';

        // Create central spine going south
        const spineLength = Math.min(5, Math.ceil(targetCount / 6));
        let lastSpineRoom = null;

        for (let i = 0; i < spineLength; i++) {
            const template = this.rng.choice(templates);
            const room = new Room({
                width: template[0],
                height: template[1],
                x: -Math.floor(template[0] / 2),
                y: lastSpineRoom ? lastSpineRoom.y + lastSpineRoom.height + 2 : -5
            });

            if (this._canPlaceRoom(room)) {
                dungeon.addRoom(room);
                this._markRoom(room);
                lastSpineRoom = room;
            }
        }

        // Add branches on both sides
        let attempts = 0;
        const maxAttempts = targetCount * 50;

        while (dungeon.rooms.length < targetCount && attempts < maxAttempts) {
            attempts++;

            // Pick a random spine room
            const anchor = this.rng.choice(dungeon.rooms);

            // Branch east/west (mirrored)
            const template = this.rng.choice(templates);

            // East branch
            const eastRoom = new Room({
                width: template[0],
                height: template[1]
            });

            if (this._placeRoomAdjacent(anchor, 'east', eastRoom, dungeon)) {
                // Create mirrored west room
                const westRoom = new Room({
                    width: template[0],
                    height: template[1],
                    x: -eastRoom.x - template[0],
                    y: eastRoom.y
                });

                if (this._canPlaceRoom(westRoom)) {
                    dungeon.addRoom(westRoom);
                    this._markRoom(westRoom);
                    this._mirrorPairs.set(eastRoom.id, westRoom.id);
                    this._mirrorPairs.set(westRoom.id, eastRoom.id);
                }
            }
        }
    }

    /**
     * Check if room can be placed (no collisions)
     */
    _canPlaceRoom(room, margin = 1) {
        return this.occupancy.isRectEmpty(
            room.x, room.y,
            room.width, room.height,
            margin
        );
    }

    /**
     * Mark room cells as occupied
     */
    _markRoom(room) {
        this.occupancy.markRect(room.x, room.y, room.width, room.height, 1);
    }

    /**
     * Place room adjacent to anchor in given direction
     */
    _placeRoomAdjacent(anchor, direction, newRoom, dungeon) {
        const spacing = this.rng.randInt(...this.params.getSpacingRange());
        const ac = anchor.centerGrid;

        // Position based on direction
        switch (direction) {
            case 'north':
                newRoom.x = ac.x - Math.floor(newRoom.width / 2);
                newRoom.y = anchor.y - spacing - newRoom.height;
                break;
            case 'south':
                newRoom.x = ac.x - Math.floor(newRoom.width / 2);
                newRoom.y = anchor.y + anchor.height + spacing;
                break;
            case 'east':
                newRoom.x = anchor.x + anchor.width + spacing;
                newRoom.y = ac.y - Math.floor(newRoom.height / 2);
                break;
            case 'west':
                newRoom.x = anchor.x - spacing - newRoom.width;
                newRoom.y = ac.y - Math.floor(newRoom.height / 2);
                break;
        }

        if (this._canPlaceRoom(newRoom)) {
            dungeon.addRoom(newRoom);
            this._markRoom(newRoom);

            // Create connecting passage
            this._createPassage(anchor, newRoom, dungeon);

            return true;
        }

        return false;
    }

    /**
     * Connect rooms using minimum spanning tree
     */
    _connectRooms(dungeon) {
        if (dungeon.rooms.length < 2) return;

        // Build edge list with distances
        const edges = [];
        for (let i = 0; i < dungeon.rooms.length; i++) {
            for (let j = i + 1; j < dungeon.rooms.length; j++) {
                const r1 = dungeon.rooms[i];
                const r2 = dungeon.rooms[j];
                const c1 = r1.centerWorld;
                const c2 = r2.centerWorld;
                const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
                edges.push({ i, j, dist, r1, r2 });
            }
        }

        // Sort by distance
        edges.sort((a, b) => a.dist - b.dist);

        // Kruskal's MST
        const parent = dungeon.rooms.map((_, i) => i);

        function find(x) {
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        }

        function union(x, y) {
            const px = find(x);
            const py = find(y);
            if (px !== py) {
                parent[px] = py;
                return true;
            }
            return false;
        }

        // Add MST edges
        for (const edge of edges) {
            if (union(edge.i, edge.j)) {
                const pairKey = this._pairKey(edge.r1.id, edge.r2.id);
                if (!this._connectedPairs.has(pairKey)) {
                    this._createPassage(edge.r1, edge.r2, dungeon);
                }
            }
        }
    }

    /**
     * Add extra connections for more interesting layouts
     */
    _addExtraConnections(dungeon) {
        const extraChance = 0.15; // 15% chance per potential connection

        for (let i = 0; i < dungeon.rooms.length; i++) {
            for (let j = i + 1; j < dungeon.rooms.length; j++) {
                const r1 = dungeon.rooms[i];
                const r2 = dungeon.rooms[j];

                const pairKey = this._pairKey(r1.id, r2.id);
                if (this._connectedPairs.has(pairKey)) continue;

                // Only connect nearby rooms
                const c1 = r1.centerWorld;
                const c2 = r2.centerWorld;
                const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);

                if (dist < 15 && this.rng.random() < extraChance) {
                    this._createPassage(r1, r2, dungeon);
                }
            }
        }
    }

    /**
     * Create a passage between two rooms
     */
    _createPassage(room1, room2, dungeon) {
        const c1 = room1.centerGrid;
        const c2 = room2.centerGrid;

        // Calculate waypoints for L-shaped passage
        const waypoints = [];

        // Start at room1 edge
        const start = this._getRoomEdgePoint(room1, c2);
        waypoints.push(start);

        // Decide if horizontal or vertical first
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal first
            waypoints.push({ x: c2.x, y: start.y });
        } else {
            // Vertical first
            waypoints.push({ x: start.x, y: c2.y });
        }

        // End at room2 edge
        const end = this._getRoomEdgePoint(room2, c1);
        waypoints.push(end);

        const passage = new Passage({
            startRoom: room1.id,
            endRoom: room2.id,
            waypoints
        });

        dungeon.addPassage(passage);
        room1.connections.push(room2.id);
        room2.connections.push(room1.id);

        const pairKey = this._pairKey(room1.id, room2.id);
        this._connectedPairs.set(pairKey, true);

        return passage;
    }

    /**
     * Get point on room edge closest to target
     */
    _getRoomEdgePoint(room, target) {
        const c = room.centerGrid;
        const dx = target.x - c.x;
        const dy = target.y - c.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Exit from east or west
            return {
                x: dx > 0 ? room.x + room.width : room.x - 1,
                y: c.y
            };
        } else {
            // Exit from north or south
            return {
                x: c.x,
                y: dy > 0 ? room.y + room.height : room.y - 1
            };
        }
    }

    /**
     * Generate doors at room entrances
     */
    _generateDoors(dungeon) {
        for (const passage of dungeon.passages) {
            const wp = passage.waypoints;
            if (wp.length < 2) continue;

            // Door at start
            const startRoom = dungeon.getRoom(passage.startRoom);
            if (startRoom) {
                const dir = this._getDirection(startRoom.centerGrid, wp[0]);
                const door = new Door({
                    x: wp[0].x,
                    y: wp[0].y,
                    direction: dir,
                    doorType: this.rng.random() < 0.6 ? DoorType.CLOSED : DoorType.OPEN,
                    roomId: startRoom.id,
                    passageId: passage.id
                });
                dungeon.addDoor(door);
            }
        }
    }

    /**
     * Generate dungeon exits
     */
    _generateExits(dungeon) {
        if (dungeon.rooms.length === 0) return;

        // Main entrance on first room
        const entranceRoom = dungeon.rooms[0];
        const exit = new Exit({
            x: entranceRoom.x + Math.floor(entranceRoom.width / 2),
            y: entranceRoom.y - 1,
            direction: 'north',
            exitType: ExitType.ENTRANCE,
            roomId: entranceRoom.id,
            isMain: true
        });
        dungeon.exits.push(exit);
    }

    /**
     * Number rooms by distance from entrance
     */
    _numberRooms(dungeon) {
        if (dungeon.rooms.length === 0) return;

        // BFS from entrance
        const queue = [dungeon.rooms[0]];
        const visited = new Set([dungeon.rooms[0].id]);
        let number = 1;

        while (queue.length > 0) {
            const room = queue.shift();
            room.number = number++;

            // Find connected rooms
            for (const connId of room.connections) {
                if (!visited.has(connId)) {
                    visited.add(connId);
                    const connRoom = dungeon.getRoom(connId);
                    if (connRoom) queue.push(connRoom);
                }
            }
        }
    }

    /**
     * Get direction from point a to point b
     */
    _getDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'east' : 'west';
        } else {
            return dy > 0 ? 'south' : 'north';
        }
    }

    /**
     * Create consistent pair key for two room IDs
     */
    _pairKey(id1, id2) {
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }
}
