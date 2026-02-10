/**
 * Dungeon Generation Parameters
 * 
 * Legacy parameter constants.
 * Most logic has moved to dungeongen.js and generator.js.
 */

export const DungeonSize = {
    TINY: 'tiny',
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    XLARGE: 'xlarge'
};

export const SymmetryType = {
    NONE: 'none',
    BILATERAL: 'bilateral'
};

export const WaterDepth = {
    DRY: 0,
    PUDDLES: 0.45,
    POOLS: 0.65,
    LAKES: 0.82,
    FLOODED: 0.90
};
