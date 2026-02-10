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
import { VerticalPlacer } from './verticality.js';
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

        // Phase 6: Vertical Connectivity
        this._placeStairs();

        // Phase 7: Place Doors (explicitly at room entries)
        // Renumbered to 7 in flow
        this._placeDoors();

        return this.grid;
    }

    _placeExits() {
        const exitPlacer = new ExitPlacer(this.grid, this.options);
        exitPlacer.placeExits();
    }

    _placeStairs() {
        const placer = new VerticalPlacer(this.grid, this.options);
        placer.placeStairs();
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
}



