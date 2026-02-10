/**
 * Advanced Room Placement Logic
 * 
 * Implements Phase 2 of the dungeon generation framework.
 * Handles room budgeting, sizing, and placement strategies.
 */

import { Room, CellType } from './models.js';

export const PlacementStrategy = {
    STANDARD: 'standard',       // Random non-overlapping
    RELAXATION: 'relaxation',   // Scatter & Separate
    SYMMETRIC: 'symmetric'      // Mirrored placement
};

export const RoomSizeBias = {
    SMALL: 'small',
    LARGE: 'large',
    BALANCED: 'balanced'
};

export class RoomPlacer {
    constructor(grid, options = {}) {
        this.grid = grid;
        this.options = options;

        // Defaults
        this.density = options.density || 0.4; // Target fill percentage (0.1 - 1.0)
        this.roomSizeBias = options.roomSizeBias || RoomSizeBias.BALANCED;
        this.placementStrategy = options.placementAlgorithm || PlacementStrategy.STANDARD;
    }

    placeRooms() {
        const roomCount = this._calculateRoomBudget();

        switch (this.placementStrategy) {
            case PlacementStrategy.RELAXATION:
                this._placeRoomsRelaxation(roomCount);
                break;
            case PlacementStrategy.SYMMETRIC:
                this._placeRoomsSymmetric(roomCount);
                break;
            case PlacementStrategy.STANDARD:
            default:
                this._placeRoomsStandard(roomCount);
                break;
        }

        // Finalize rooms: Carve them into the grid
        for (const room of this.grid.rooms) {
            this.grid.carveRect(room.x, room.y, room.width, room.height, CellType.FLOOR);
        }
    }

    _calculateRoomBudget() {
        if (this.options.numRooms) return this.options.numRooms;

        // Calculate based on density
        // Valid area approx = width * height * mask_factor (assume 0.7 for circular masks etc)
        // Let's just use width*height for budget baseline
        const area = this.grid.width * this.grid.height;
        const avgRoomArea = 80; // 8x10 approx

        // room_target = map_area * density_factor / average_room_area
        const target = Math.floor((area * this.density) / avgRoomArea);
        return Math.max(5, Math.min(target, 100)); // Clamp
    }

    _sampleRoomSize() {
        const min = this.options.minRoomSize || 6;
        const max = this.options.maxRoomSize || 12;

        let w, h;

        if (this.roomSizeBias === RoomSizeBias.SMALL) {
            // Bias towards min
            w = Math.floor(Math.random() * (max - min) * 0.3) + min;
            h = Math.floor(Math.random() * (max - min) * 0.3) + min;
        } else if (this.roomSizeBias === RoomSizeBias.LARGE) {
            // Bias towards max
            w = Math.floor(Math.random() * (max - min) * 0.5) + (max - (max - min) * 0.5);
            h = Math.floor(Math.random() * (max - min) * 0.5) + (max - (max - min) * 0.5);
        } else {
            // Balanced (Uniform)
            w = Math.floor(Math.random() * (max - min + 1)) + min;
            h = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return { w: Math.floor(w), h: Math.floor(h) };
    }

    _placeRoomsStandard(targetCount) {
        let attempts = 0;
        const maxAttempts = targetCount * 50;

        while (this.grid.rooms.length < targetCount && attempts < maxAttempts) {
            attempts++;
            const { w, h } = this._sampleRoomSize();
            const x = Math.floor(Math.random() * (this.grid.width - w - 4)) + 2;
            const y = Math.floor(Math.random() * (this.grid.height - h - 4)) + 2;

            if (this._isValidPlacement(x, y, w, h)) {
                this.grid.rooms.push(new Room(x, y, w, h));
            }
        }
    }

    _placeRoomsSymmetric(targetCount) {
        let attempts = 0;
        const maxAttempts = targetCount * 50;
        const symmetryType = 'horizontal'; // Could be option: vertical, horizontal, both

        while (this.grid.rooms.length < targetCount && attempts < maxAttempts) {
            attempts++;
            const { w, h } = this._sampleRoomSize();

            // Place in one half (Left half for Horizontal symmetry)
            const halfW = Math.floor((this.grid.width - 2) / 2);
            const x = Math.floor(Math.random() * (halfW - w - 2)) + 2;
            const y = Math.floor(Math.random() * (this.grid.height - h - 4)) + 2;

            // Mirror coords
            const mirrorX = this.grid.width - x - w;
            const mirrorY = y;

            // Check primary
            if (!this._isValidPlacement(x, y, w, h)) continue;

            // Check mirror
            if (!this._isValidPlacement(mirrorX, mirrorY, w, h)) continue;

            // Add both
            this.grid.rooms.push(new Room(x, y, w, h));
            this.grid.rooms.push(new Room(mirrorX, mirrorY, w, h));
        }
    }

    _placeRoomsRelaxation(targetCount) {
        // 1. Scatter randomly without overlap checks (but inside bounds)
        const tempRooms = [];
        for (let i = 0; i < targetCount; i++) {
            const { w, h } = this._sampleRoomSize();
            const x = Math.floor(Math.random() * (this.grid.width - w - 4)) + 2;
            const y = Math.floor(Math.random() * (this.grid.height - h - 4)) + 2;
            tempRooms.push(new Room(x, y, w, h));
        }

        // 2. Resolve Collisions (Iterative)
        const iterations = 50;
        for (let i = 0; i < iterations; i++) {
            let moved = false;
            for (let j = 0; j < tempRooms.length; j++) {
                for (let k = j + 1; k < tempRooms.length; k++) {
                    const r1 = tempRooms[j];
                    const r2 = tempRooms[k];

                    if (this._roomsOverlap(r1, r2, 1)) { // 1 padding
                        // Push apart
                        const dx = r1.center.x - r2.center.x;
                        const dy = r1.center.y - r2.center.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist === 0) {
                            r1.x += 1;
                            continue;
                        }

                        // Normalize push vector
                        const pushX = Math.round((dx / dist));
                        const pushY = Math.round((dy / dist));

                        r1.x += pushX;
                        r1.y += pushY;
                        r2.x -= pushX;
                        r2.y -= pushY;

                        this._clampRoom(r1);
                        this._clampRoom(r2);
                        moved = true;
                    }
                }
            }
            if (!moved) break;
        }

        // 3. Final Verification & Mask Check
        for (const room of tempRooms) {
            // Must not overlap final list (order sensitive)
            // Actually, we just check against each other.
            // But we specifically need to check the MASK now.
            // If a room was pushed into the void, discard it.
            if (this.grid.isRegionValid(room.x, room.y, room.width, room.height)) {
                // Ensure no overlaps with already accepted rooms (if any, though we resolved pairs above)
                // Let's just double check to be safe from the push step artifacts
                if (this._isValidPlacement(room.x, room.y, room.width, room.height)) {
                    this.grid.rooms.push(room);
                }
            }
        }
    }

    _isValidPlacement(x, y, w, h) {
        // 1. Check Mask
        if (!this.grid.isRegionValid(x, y, w, h)) return false;

        // 2. Check Overlaps with existing rooms + buffer
        // Note: isRegionEmpty checks if grid cells are EMPTY. 
        // But for Relaxed/Symmetric, we haven't carved yet.
        // So we must check against this.grid.rooms list.
        for (const r of this.grid.rooms) {
            if (x < r.x + r.width + 2 && x + w + 2 > r.x &&
                y < r.y + r.height + 2 && y + h + 2 > r.y) {
                return false;
            }
        }
        return true;
    }

    _roomsOverlap(r1, r2, buffer = 0) {
        return (r1.x < r2.x + r2.width + buffer && r1.x + r1.width + buffer > r2.x &&
            r1.y < r2.y + r2.height + buffer && r1.y + r1.height + buffer > r2.y);
    }

    _clampRoom(room) {
        room.x = Math.max(2, Math.min(room.x, this.grid.width - room.width - 2));
        room.y = Math.max(2, Math.min(room.y, this.grid.height - room.height - 2));
    }
}
