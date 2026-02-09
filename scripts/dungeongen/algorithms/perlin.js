/**
 * Perlin Noise Implementation
 * 
 * Classic Perlin noise algorithm for procedural generation.
 * Used for water features and organic randomness.
 */

/**
 * Permutation table for noise generation
 */
const PERM = new Uint8Array(512);
const GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/**
 * Seed the permutation table
 * @param {number} seed - Random seed
 */
export function seedNoise(seed) {
    const p = new Uint8Array(256);

    // Initialize with values 0-255
    for (let i = 0; i < 256; i++) {
        p[i] = i;
    }

    // Shuffle using seed
    let random = seed;
    for (let i = 255; i > 0; i--) {
        // Simple LCG random
        random = (random * 1103515245 + 12345) & 0x7fffffff;
        const j = random % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for overflow
    for (let i = 0; i < 512; i++) {
        PERM[i] = p[i & 255];
    }
}

/**
 * Fade function for smooth interpolation
 * @param {number} t - Value 0-1
 * @returns {number} Smoothed value
 */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
    return a + t * (b - a);
}

/**
 * Calculate gradient dot product
 * @param {number} hash - Hash value
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Dot product
 */
function grad(hash, x, y) {
    const h = hash & 11;
    const g = GRAD3[h];
    return g[0] * x + g[1] * y;
}

/**
 * 2D Perlin noise
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Noise value (-1 to 1)
 */
export function noise2D(x, y) {
    // Find unit grid cell
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Relative position in cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Fade curves
    const u = fade(xf);
    const v = fade(yf);

    // Hash corners
    const aa = PERM[PERM[X] + Y];
    const ab = PERM[PERM[X] + Y + 1];
    const ba = PERM[PERM[X + 1] + Y];
    const bb = PERM[PERM[X + 1] + Y + 1];

    // Blend
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
}

/**
 * Fractal Brownian Motion (FBM) noise
 * Combines multiple octaves of noise for natural-looking patterns
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} octaves - Number of octaves (default 4)
 * @param {number} lacunarity - Frequency multiplier (default 2)
 * @param {number} persistence - Amplitude multiplier (default 0.5)
 * @returns {number} FBM noise value
 */
export function fbm(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise2D(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return value / maxValue;
}

// Initialize with default seed
seedNoise(42);
