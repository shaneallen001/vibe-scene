/**
 * Poisson Disk Sampling
 * 
 * Generates evenly-distributed random points with minimum spacing.
 * Used for decoration placement (columns, rocks, etc).
 */

/**
 * Generate Poisson disk samples in a rectangular region
 * @param {number} width - Region width
 * @param {number} height - Region height
 * @param {number} minDistance - Minimum distance between points
 * @param {number} maxAttempts - Attempts before rejecting (default 30)
 * @param {function} random - Random function returning 0-1 (default Math.random)
 * @returns {Array<{x: number, y: number}>} Array of sample points
 */
export function poissonDiskSample(width, height, minDistance, maxAttempts = 30, random = Math.random) {
    const cellSize = minDistance / Math.SQRT2;
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);

    // Grid for fast neighbor lookup
    const grid = new Array(gridWidth * gridHeight).fill(-1);
    const samples = [];
    const active = [];

    /**
     * Get grid cell index for a point
     */
    function gridIndex(x, y) {
        const gx = Math.floor(x / cellSize);
        const gy = Math.floor(y / cellSize);
        return gy * gridWidth + gx;
    }

    /**
     * Check if point is valid (far enough from all neighbors)
     */
    function isValid(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return false;
        }

        const gx = Math.floor(x / cellSize);
        const gy = Math.floor(y / cellSize);

        // Check 5x5 grid neighborhood
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = gx + dx;
                const ny = gy + dy;

                if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                    const idx = grid[ny * gridWidth + nx];
                    if (idx !== -1) {
                        const sample = samples[idx];
                        const distSq = (x - sample.x) ** 2 + (y - sample.y) ** 2;
                        if (distSq < minDistance * minDistance) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    /**
     * Add a sample to the grid and active list
     */
    function addSample(x, y) {
        const sample = { x, y };
        const idx = samples.length;
        samples.push(sample);
        active.push(idx);
        grid[gridIndex(x, y)] = idx;
        return sample;
    }

    // Start with a random initial point
    const startX = random() * width;
    const startY = random() * height;
    addSample(startX, startY);

    // Process active list
    while (active.length > 0) {
        // Pick random active sample
        const activeIdx = Math.floor(random() * active.length);
        const sampleIdx = active[activeIdx];
        const sample = samples[sampleIdx];

        let foundValid = false;

        // Try to find a valid point around this sample
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Random point in annulus [minDistance, 2*minDistance]
            const angle = random() * Math.PI * 2;
            const distance = minDistance * (1 + random());

            const newX = sample.x + Math.cos(angle) * distance;
            const newY = sample.y + Math.sin(angle) * distance;

            if (isValid(newX, newY)) {
                addSample(newX, newY);
                foundValid = true;
                break;
            }
        }

        // No valid point found, remove from active list
        if (!foundValid) {
            active.splice(activeIdx, 1);
        }
    }

    return samples;
}

/**
 * Generate Poisson samples within a polygon boundary
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @param {number} minDistance - Minimum distance between points
 * @param {number} maxAttempts - Attempts before rejecting
 * @param {function} random - Random function
 * @returns {Array<{x: number, y: number}>} Array of sample points
 */
export function poissonDiskSamplePolygon(polygon, minDistance, maxAttempts = 30, random = Math.random) {
    // Get bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of polygon) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    // Generate samples in bounding box
    const width = maxX - minX;
    const height = maxY - minY;
    const samples = poissonDiskSample(width, height, minDistance, maxAttempts, random);

    // Filter to only points inside polygon
    return samples
        .map(s => ({ x: s.x + minX, y: s.y + minY }))
        .filter(s => pointInPolygon(s, polygon));
}

/**
 * Check if point is inside polygon (ray casting algorithm)
 * @param {Object} point - Point {x, y}
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} True if point is inside
 */
export function pointInPolygon(point, polygon) {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        if (((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}
