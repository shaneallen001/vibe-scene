/**
 * Spatial Constraints & Masking
 * 
 * Implements Phase 1 of the dungeon generation framework.
 * Defines the valid carving space using various mask shapes.
 */

import { CellType } from './models.js';

export const MapMaskType = {
    RECTANGLE: 'rectangle',
    ROUND: 'round',
    CROSS: 'cross',
    CAVERNOUS: 'cavernous',
    KEEP: 'keep'
};

/**
 * Apply a spatial mask to the dungeon grid.
 * The mask defines which cells are valid for carving (1) and which are void (0).
 * 
 * @param {DungeonGrid} grid - The dungeon grid to mask
 * @param {Object} config - Configuration options
 * @param {string} config.maskType - The type of mask to apply
 */
export function applyMapEnvelope(grid, config) {
    const maskType = config.maskType || MapMaskType.RECTANGLE;
    const w = grid.width;
    const h = grid.height;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    // Initialize mask with 0 (blocked)
    grid.mask.fill(0);

    switch (maskType) {
        case MapMaskType.RECTANGLE:
            // Full grid is active (except maybe a 1-cell border?)
            // Let's keep a 1-cell border as void to prevent open edges
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    grid.setMask(x, y, 1);
                }
            }
            break;

        case MapMaskType.ROUND:
            // Radial distance mask
            const radius = Math.min(w, h) / 2 - 2; // -2 for padding
            const r2 = radius * radius;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    if (dx * dx + dy * dy <= r2) {
                        grid.setMask(x, y, 1);
                    }
                }
            }
            break;

        case MapMaskType.CROSS:
            // Intersecting rectangular masks
            const armWidth = Math.min(w, h) / 3;
            const halfArm = armWidth / 2;

            // Horizontal arm
            for (let y = Math.floor(cy - halfArm); y < Math.ceil(cy + halfArm); y++) {
                for (let x = 2; x < w - 2; x++) {
                    if (y >= 0 && y < h) grid.setMask(x, y, 1);
                }
            }
            // Vertical arm
            for (let x = Math.floor(cx - halfArm); x < Math.ceil(cx + halfArm); x++) {
                for (let y = 2; y < h - 2; y++) {
                    if (x >= 0 && x < w) grid.setMask(x, y, 1);
                }
            }
            break;

        case MapMaskType.KEEP:
            // Central structured area with a void in the middle (Donjon "Keep" style?)
            // Or maybe "Keep" means a solid block in the middle? 
            // Donjon's "Keep" is usually a square-ish shape. 
            // Let's implement valid carving space as a large central rectangle, 
            // strictly padded.
            for (let y = 4; y < h - 4; y++) {
                for (let x = 4; x < w - 4; x++) {
                    grid.setMask(x, y, 1);
                }
            }
            break;

        case MapMaskType.CAVERNOUS:
            // Noise based mask. 
            // For now, let's just make it a rough circle/organic shape 
            // since we don't have a simplex noise library imported yet.
            // We can simple cellular automata it or use Math.random with smoothing.

            // 1. Random noise
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    if (Math.random() < 0.55) grid.setMask(x, y, 1);
                }
            }
            // 2. Cellular Automata smoothing (valid space smoothing)
            for (let i = 0; i < 5; i++) {
                const newMask = new Int8Array(grid.mask);
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        let neighbors = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (grid.getMask(x + dx, y + dy)) neighbors++;
                            }
                        }
                        // If alive and 4+ neighbors, stay alive. If dead and 5+ neighbors, become alive.
                        const alive = grid.getMask(x, y);
                        if (alive && neighbors >= 4) {
                            newMask[y * w + x] = 1;
                        } else if (!alive && neighbors >= 5) {
                            newMask[y * w + x] = 1;
                        } else {
                            newMask[y * w + x] = 0;
                        }
                    }
                }
                grid.mask = newMask;
            }
            // Ensure connectivity to center? Not strictly necessary for the mask phase itself,
            // but helpful. For now, leave as is.
            break;

        default:
            // Default to Rectangle
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    grid.setMask(x, y, 1);
                }
            }
            break;
    }
}
