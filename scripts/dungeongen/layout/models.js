/**
 * Dungeon Layout Data Models
 * 
 * Core data structures for dungeon generation.
 * Ported from dungeongen Python models.
 */

/**
 * Room shapes
 */
export const RoomShape = {
    RECT: 'rect',
    SQUARE: 'square',
    CIRCLE: 'circle',
    OCTAGON: 'octagon'
};

/**
 * Passage visual styles
 */
export const PassageStyle = {
    STRAIGHT: 'straight',
    L_BEND: 'l_bend',
    S_CURVE: 's_curve',
    Z_BEND: 'z_bend'
};

/**
 * Door types
 */
export const DoorType = {
    OPEN: 'open',
    CLOSED: 'closed',
    LOCKED: 'locked',
    SECRET: 'secret'
};

/**
 * Stair direction
 */
export const StairDirection = {
    UP: 'up',
    DOWN: 'down'
};

/**
 * Exit types
 */
export const ExitType = {
    ENTRANCE: 'entrance',
    EXIT: 'exit',
    STAIRS_UP: 'stairs_up',
    STAIRS_DOWN: 'stairs_down'
};

/**
 * Generate unique ID
 */
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Room class
 */
export class Room {
    constructor(options = {}) {
        this.id = options.id || generateId();
        this.x = options.x ?? 0;           // Grid position (top-left)
        this.y = options.y ?? 0;
        this.width = options.width ?? 3;   // Grid units
        this.height = options.height ?? 3;
        this.shape = options.shape ?? RoomShape.RECT;
        this.z = options.z ?? 0;           // Level (0 = ground)
        this.tags = options.tags ?? [];
        this.connections = options.connections ?? []; // Connected room IDs
        this.number = options.number ?? 0; // Room number for labeling
    }

    /**
     * Get center in integer grid coordinates
     */
    get centerGrid() {
        return {
            x: Math.floor(this.x + this.width / 2),
            y: Math.floor(this.y + this.height / 2)
        };
    }

    /**
     * Get center in float world coordinates
     */
    get centerWorld() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    /**
     * Get bounding box (x1, y1, x2, y2)
     */
    get bounds() {
        return {
            x1: this.x,
            y1: this.y,
            x2: this.x + this.width,
            y2: this.y + this.height
        };
    }

    /**
     * Check if this room intersects another (with optional margin)
     */
    intersects(other, margin = 0) {
        const a = this.bounds;
        const b = other.bounds;

        return !(
            a.x2 + margin <= b.x1 - margin ||
            a.x1 - margin >= b.x2 + margin ||
            a.y2 + margin <= b.y1 - margin ||
            a.y1 - margin >= b.y2 + margin
        );
    }

    /**
     * Clone this room
     */
    clone() {
        return new Room({
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            shape: this.shape,
            z: this.z,
            tags: [...this.tags],
            connections: [...this.connections],
            number: this.number
        });
    }
}

/**
 * Passage (corridor) connecting two rooms
 */
export class Passage {
    constructor(options = {}) {
        this.id = options.id || generateId();
        this.startRoom = options.startRoom || '';   // Room ID
        this.endRoom = options.endRoom || '';       // Room ID
        this.waypoints = options.waypoints ?? [];   // Array of {x, y} points
        this.width = options.width ?? 1;            // Grid units
        this.style = options.style ?? PassageStyle.STRAIGHT;
    }

    /**
     * Get passage length in grid units
     */
    get length() {
        let len = 0;
        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const a = this.waypoints[i];
            const b = this.waypoints[i + 1];
            len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        }
        return len;
    }
}

/**
 * Door at a room entrance
 */
export class Door {
    constructor(options = {}) {
        this.id = options.id || generateId();
        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.direction = options.direction ?? 'south'; // north/south/east/west
        this.doorType = options.doorType ?? DoorType.CLOSED;
        this.roomId = options.roomId || '';
        this.passageId = options.passageId || '';
    }
}

/**
 * Stairs in a passage
 */
export class Stair {
    constructor(options = {}) {
        this.id = options.id || generateId();
        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.direction = options.direction ?? 'south';
        this.stairDir = options.stairDir ?? StairDirection.DOWN;
        this.passageId = options.passageId || '';
    }
}

/**
 * Dungeon entrance/exit
 */
export class Exit {
    constructor(options = {}) {
        this.id = options.id || generateId();
        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.direction = options.direction ?? 'north';
        this.exitType = options.exitType ?? ExitType.ENTRANCE;
        this.roomId = options.roomId || '';
        this.isMain = options.isMain ?? false;
    }
}

/**
 * Complete dungeon layout
 */
export class Dungeon {
    constructor(seed = 0) {
        this.seed = seed;
        this.rooms = [];
        this.passages = [];
        this.doors = [];
        this.stairs = [];
        this.exits = [];
        this.mirrorPairs = {};      // Maps room ID to mirrored room ID
        this.spineDirection = 'south';
        this.propsSeed = 0;
    }

    /**
     * Add a room
     */
    addRoom(room) {
        this.rooms.push(room);
        return room;
    }

    /**
     * Add a passage
     */
    addPassage(passage) {
        this.passages.push(passage);
        return passage;
    }

    /**
     * Add a door
     */
    addDoor(door) {
        this.doors.push(door);
        return door;
    }

    /**
     * Get room by ID
     */
    getRoom(id) {
        return this.rooms.find(r => r.id === id);
    }

    /**
     * Get bounding box of entire dungeon
     */
    get bounds() {
        if (this.rooms.length === 0) {
            return { x1: 0, y1: 0, x2: 10, y2: 10 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const room of this.rooms) {
            const b = room.bounds;
            minX = Math.min(minX, b.x1);
            minY = Math.min(minY, b.y1);
            maxX = Math.max(maxX, b.x2);
            maxY = Math.max(maxY, b.y2);
        }

        // Include passages
        for (const passage of this.passages) {
            for (const wp of passage.waypoints) {
                minX = Math.min(minX, wp.x);
                minY = Math.min(minY, wp.y);
                maxX = Math.max(maxX, wp.x + 1);
                maxY = Math.max(maxY, wp.y + 1);
            }
        }

        return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    }
}
