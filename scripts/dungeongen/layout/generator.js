/**
 * Grid-Based Dungeon Generator
 * 
 * Generates dungeons by painting cells onto a grid.
 */

import { DungeonGrid, CellType, Room, Door } from './models.js';
import { applyMapEnvelope } from './constraints.js';
import { RoomPlacer } from './room_placement.js';
import { NetworkConnector, pruneDeadEnds } from './connectivity.js';
import { ExitPlacer } from './exits.js';
import { DoorPlacer } from './doors.js';

export class DungeonGenerator {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        this.options = options;
        // Initialize grid
        this.grid = new DungeonGrid(width, height);
    }

    generate() {
        // Phase 1: Spatial Constraint Definition
        applyMapEnvelope(this.grid, this.options);

        // Phase 2: Place Rooms with explicit buffer
        this._placeRooms();

        // Phase 3: Connect Rooms (MST) & Route Passages using A*
        this._connectRooms();

        // Phase 4: Dead-End Pruning
        pruneDeadEnds(this.grid, this.options);

        // Phase 5: Edge & Exit Handling
        this._placeExits();



        // Phase 7: Place Doors (explicitly at room entries)
        // Renumbered to 7 in flow
        this._placeDoors();

        return this.grid;
    }

    /**
     * Generate dungeon from explicit room definitions instead of random placement.
     * @param {Object} outline - { rooms: [{id,x,y,width,height,theme,description}], connections }
     * @returns {DungeonGrid}
     */
    generateFromOutline(outline = {}) {
        // Phase 1: Spatial Constraint Definition
        applyMapEnvelope(this.grid, this.options);

        // Phase 2: Paint explicit rooms
        this.grid.rooms = [];
        const usedIds = new Set();
        const normalizedRooms = Array.isArray(outline.rooms) ? outline.rooms : [];
        for (const def of normalizedRooms) {
            const room = this._normalizeOutlineRoom(def, usedIds);
            if (!room) continue;

            // Respect mask and avoid overlaps for stability.
            if (!this.grid.isRegionValid(room.x, room.y, room.width, room.height)) continue;
            if (!this.grid.isRegionEmpty(room.x, room.y, room.width, room.height)) continue;

            this.grid.carveRect(room.x, room.y, room.width, room.height, CellType.FLOOR);
            this.grid.rooms.push(room);
            usedIds.add(String(room.id));
        }

        if (this.grid.rooms.length === 0) {
            // Fail-safe: if no AI rooms survive validation, fallback to normal placement.
            this._placeRooms();
        }

        // Phase 3: Connect rooms via explicit pairs when available.
        const connector = new NetworkConnector(this.grid, this.options);
        const pairs = Array.isArray(outline.connections) ? outline.connections : [];
        if (pairs.length > 0) {
            const linked = connector.connectSpecificRooms(pairs);
            if (linked === 0) {
                connector.connectRooms();
            }
        } else {
            connector.connectRooms();
        }

        // Phase 4: Dead-End Pruning
        pruneDeadEnds(this.grid, this.options);

        // Phase 5: Edge & Exit Handling
        this._placeExits();

        // Phase 7: Place Doors
        this._placeDoors();

        return this.grid;
    }

    _placeExits() {
        const exitPlacer = new ExitPlacer(this.grid, this.options);
        exitPlacer.placeExits();
    }



    _placeRooms() {
        const placer = new RoomPlacer(this.grid, this.options);
        placer.placeRooms();
    }

    _connectRooms() {
        const connector = new NetworkConnector(this.grid, this.options);
        connector.connectRooms();
    }

    _placeDoors() {
        const placer = new DoorPlacer(this.grid, this.options);
        placer.placeDoors();
    }

    _getRoomAt(x, y) {
        return this.grid.rooms.find(r =>
            x >= r.x && x < r.x + r.width &&
            y >= r.y && y < r.y + r.height
        );
    }

    _normalizeOutlineRoom(def, usedIds) {
        if (!def || typeof def !== 'object') return null;
        const x = Math.max(1, Math.floor(Number(def.x)));
        const y = Math.max(1, Math.floor(Number(def.y)));
        const width = Math.max(3, Math.floor(Number(def.width)));
        const height = Math.max(3, Math.floor(Number(def.height)));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
        }
        const room = new Room(x, y, width, height);
        const requestedId = String(def.id || '').trim();
        if (requestedId && !usedIds.has(requestedId)) {
            room.id = requestedId;
        }
        room.theme = String(def.theme || '').trim();
        room.description = String(def.description || '').trim();
        room.connections = [];
        return room;
    }
}



