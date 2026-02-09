/**
 * Dungeon Generation Parameters
 * 
 * Configuration for dungeon size, symmetry, and features.
 */

/**
 * Dungeon size presets
 */
export const DungeonSize = {
    TINY: 'tiny',
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    XLARGE: 'xlarge'
};

/**
 * Size configurations (room count ranges)
 */
export const SIZE_CONFIG = {
    [DungeonSize.TINY]: { min: 4, max: 6 },
    [DungeonSize.SMALL]: { min: 6, max: 10 },
    [DungeonSize.MEDIUM]: { min: 10, max: 20 },
    [DungeonSize.LARGE]: { min: 20, max: 35 },
    [DungeonSize.XLARGE]: { min: 35, max: 50 }
};

/**
 * Symmetry types
 */
export const SymmetryType = {
    NONE: 'none',
    BILATERAL: 'bilateral'
};

/**
 * Water depth levels
 */
export const WaterDepth = {
    DRY: 0,
    PUDDLES: 0.45,
    POOLS: 0.65,
    LAKES: 0.82,
    FLOODED: 0.90
};

/**
 * Parse water depth from string
 */
export function parseWaterDepth(value) {
    const key = String(value).toUpperCase();
    return WaterDepth[key] ?? WaterDepth.DRY;
}

/**
 * Room size templates: [width, height] pairs
 */
export const ROOM_TEMPLATES = {
    small: [
        [3, 3], [3, 4], [4, 3], [4, 4]
    ],
    medium: [
        [4, 5], [5, 4], [5, 5], [5, 6], [6, 5]
    ],
    large: [
        [6, 6], [6, 7], [7, 6], [7, 7], [8, 8]
    ]
};

/**
 * Circle room radii (in grid units)
 */
export const CIRCLE_RADII = {
    small: [2, 2],
    medium: [3, 3, 4],
    large: [4, 5]
};

/**
 * Generation parameters class
 */
export class GenerationParams {
    constructor(options = {}) {
        // Size preset
        this.size = options.size ?? DungeonSize.MEDIUM;

        // Symmetry type
        this.symmetry = options.symmetry ?? SymmetryType.NONE;

        // Water level (0 = dry, 0.9 = flooded)
        this.waterDepth = options.waterDepth ?? WaterDepth.DRY;

        // Enable water features
        this.waterEnabled = options.waterDepth > 0 || options.waterEnabled;

        // Room density (0.2=sparse, 0.5=normal, 0.8=tight)
        this.density = options.density ?? 0.5;

        // Random seed
        this.seed = options.seed ?? null;

        // Circle room chance (0-1)
        this.circleChance = options.circleChance ?? 0.2;
    }

    /**
     * Get room count range for current size
     */
    getRoomCountRange() {
        const config = SIZE_CONFIG[this.size] ?? SIZE_CONFIG[DungeonSize.MEDIUM];
        return [config.min, config.max];
    }

    /**
     * Get room templates for current size
     */
    getRoomTemplates() {
        // Combine templates based on size
        switch (this.size) {
            case DungeonSize.TINY:
            case DungeonSize.SMALL:
                return [...ROOM_TEMPLATES.small, ...ROOM_TEMPLATES.medium.slice(0, 2)];
            case DungeonSize.MEDIUM:
                return [...ROOM_TEMPLATES.small, ...ROOM_TEMPLATES.medium];
            case DungeonSize.LARGE:
            case DungeonSize.XLARGE:
                return [...ROOM_TEMPLATES.medium, ...ROOM_TEMPLATES.large];
            default:
                return ROOM_TEMPLATES.medium;
        }
    }

    /**
     * Get circle radii for current size
     */
    getCircleRadii() {
        switch (this.size) {
            case DungeonSize.TINY:
            case DungeonSize.SMALL:
                return CIRCLE_RADII.small;
            case DungeonSize.MEDIUM:
                return CIRCLE_RADII.medium;
            case DungeonSize.LARGE:
            case DungeonSize.XLARGE:
                return [...CIRCLE_RADII.medium, ...CIRCLE_RADII.large];
            default:
                return CIRCLE_RADII.medium;
        }
    }

    /**
     * Get spacing range based on density
     */
    getSpacingRange() {
        if (this.density >= 0.8) {
            return [1, 2];  // Tight
        } else if (this.density >= 0.4) {
            return [3, 5];  // Normal
        } else {
            return [6, 10]; // Sparse
        }
    }

    /**
     * Create from user-friendly options
     */
    static fromOptions(options) {
        const size = String(options.size || 'medium').toLowerCase();
        const symmetry = String(options.symmetry || 'none').toLowerCase();
        const waterDepth = parseWaterDepth(options.waterDepth || 'dry');

        return new GenerationParams({
            size,
            symmetry,
            waterDepth,
            waterEnabled: waterDepth > 0,
            seed: options.seed
        });
    }
}
