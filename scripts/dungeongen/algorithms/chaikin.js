/**
 * Chaikin Curve Smoothing Algorithm
 * 
 * Creates smooth curves from angular polylines by repeatedly
 * cutting corners. Used for organic shorelines and paths.
 */

/**
 * Apply Chaikin's corner-cutting algorithm to smooth a polyline
 * @param {Array<{x: number, y: number}>} points - Input points
 * @param {number} iterations - Number of smoothing iterations (default 3)
 * @param {boolean} closed - Whether the polyline is closed (default false)
 * @returns {Array<{x: number, y: number}>} Smoothed points
 */
export function chaikinSmooth(points, iterations = 3, closed = false) {
    if (points.length < 2) return points;

    let result = [...points];

    for (let iter = 0; iter < iterations; iter++) {
        const smoothed = [];
        const len = closed ? result.length : result.length - 1;

        for (let i = 0; i < len; i++) {
            const p0 = result[i];
            const p1 = result[(i + 1) % result.length];

            // Q point at 1/4 from p0 to p1
            const q = {
                x: 0.75 * p0.x + 0.25 * p1.x,
                y: 0.75 * p0.y + 0.25 * p1.y
            };

            // R point at 3/4 from p0 to p1
            const r = {
                x: 0.25 * p0.x + 0.75 * p1.x,
                y: 0.25 * p0.y + 0.75 * p1.y
            };

            smoothed.push(q, r);
        }

        // For open curves, keep the start and end points
        if (!closed && smoothed.length > 0) {
            smoothed[0] = result[0];
            smoothed[smoothed.length - 1] = result[result.length - 1];
        }

        result = smoothed;
    }

    return result;
}

/**
 * Simplify a polyline by removing points that don't significantly
 * change the path (Douglas-Peucker algorithm)
 * @param {Array<{x: number, y: number}>} points - Input points
 * @param {number} epsilon - Distance threshold for simplification
 * @returns {Array<{x: number, y: number}>} Simplified points
 */
export function simplifyPolyline(points, epsilon = 1.0) {
    if (points.length <= 2) return points;

    // Find point with maximum distance from line between first and last
    let maxDist = 0;
    let maxIndex = 0;

    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
        const left = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPolyline(points.slice(maxIndex), epsilon);

        // Combine results (removing duplicate middle point)
        return left.slice(0, -1).concat(right);
    }

    // All points are within epsilon, simplify to just endpoints
    return [start, end];
}

/**
 * Calculate perpendicular distance from point to line
 * @param {Object} point - The point {x, y}
 * @param {Object} lineStart - Line start point {x, y}
 * @param {Object} lineEnd - Line end point {x, y}
 * @returns {number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    // Line length squared
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        // Start and end are the same point
        return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }

    // Calculate perpendicular distance using cross product
    const cross = Math.abs(
        (point.y - lineStart.y) * dx - (point.x - lineStart.x) * dy
    );

    return cross / Math.sqrt(lenSq);
}
