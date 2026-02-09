/**
 * Marching Squares Algorithm
 * 
 * Extracts contour lines from a 2D field of values.
 * Used for water boundary generation.
 */

/**
 * Extract contour lines from a 2D field at a given threshold
 * @param {Float32Array|Array<Array<number>>} field - 2D field of values
 * @param {number} width - Field width
 * @param {number} height - Field height
 * @param {number} threshold - Contour threshold value
 * @returns {Array<Array<{x: number, y: number}>>} Array of contour polylines
 */
export function marchingSquares(field, width, height, threshold = 0.5) {
    const contours = [];
    const visited = new Set();

    /**
     * Get field value at position
     */
    function getValue(x, y) {
        if (Array.isArray(field[0])) {
            return field[y]?.[x] ?? 0;
        }
        return field[y * width + x] ?? 0;
    }

    /**
     * Get case index for 2x2 cell
     */
    function getCaseIndex(x, y) {
        let caseIndex = 0;
        if (getValue(x, y) >= threshold) caseIndex |= 1;
        if (getValue(x + 1, y) >= threshold) caseIndex |= 2;
        if (getValue(x + 1, y + 1) >= threshold) caseIndex |= 4;
        if (getValue(x, y + 1) >= threshold) caseIndex |= 8;
        return caseIndex;
    }

    /**
     * Linear interpolation for edge crossing point
     */
    function interpolate(v1, v2, x1, y1, x2, y2) {
        if (Math.abs(v1 - v2) < 0.0001) {
            return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        }
        const t = (threshold - v1) / (v2 - v1);
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }

    /**
     * Get contour segment for a cell
     * Returns array of 0, 1, or 2 segments
     */
    function getSegments(x, y) {
        const caseIndex = getCaseIndex(x, y);
        if (caseIndex === 0 || caseIndex === 15) return [];

        const v00 = getValue(x, y);
        const v10 = getValue(x + 1, y);
        const v11 = getValue(x + 1, y + 1);
        const v01 = getValue(x, y + 1);

        // Edge midpoints with interpolation
        const top = interpolate(v00, v10, x, y, x + 1, y);
        const right = interpolate(v10, v11, x + 1, y, x + 1, y + 1);
        const bottom = interpolate(v01, v11, x, y + 1, x + 1, y + 1);
        const left = interpolate(v00, v01, x, y, x, y + 1);

        // Lookup table for segment connections
        const segments = [];

        switch (caseIndex) {
            case 1: case 14: segments.push([left, top]); break;
            case 2: case 13: segments.push([top, right]); break;
            case 3: case 12: segments.push([left, right]); break;
            case 4: case 11: segments.push([right, bottom]); break;
            case 5:
                // Saddle point - use center value to resolve
                const center = (v00 + v10 + v11 + v01) / 4;
                if (center >= threshold) {
                    segments.push([left, top]);
                    segments.push([right, bottom]);
                } else {
                    segments.push([left, bottom]);
                    segments.push([top, right]);
                }
                break;
            case 6: case 9: segments.push([top, bottom]); break;
            case 7: case 8: segments.push([left, bottom]); break;
            case 10:
                // Saddle point
                const center2 = (v00 + v10 + v11 + v01) / 4;
                if (center2 >= threshold) {
                    segments.push([top, right]);
                    segments.push([left, bottom]);
                } else {
                    segments.push([left, top]);
                    segments.push([right, bottom]);
                }
                break;
        }

        return segments;
    }

    /**
     * Trace a contour starting from a cell
     */
    function traceContour(startX, startY, startSegment) {
        const contour = [startSegment[0], startSegment[1]];
        const cellKey = `${startX},${startY}`;
        visited.add(cellKey);

        let currentEnd = startSegment[1];
        let foundNext = true;

        while (foundNext) {
            foundNext = false;

            // Check neighboring cells
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = startX + dx;
                const ny = startY + dy;

                if (nx < 0 || nx >= width - 1 || ny < 0 || ny >= height - 1) continue;

                const nKey = `${nx},${ny}`;
                if (visited.has(nKey)) continue;

                const segments = getSegments(nx, ny);
                for (const seg of segments) {
                    // Check if segment connects to current end
                    const dist0 = Math.hypot(seg[0].x - currentEnd.x, seg[0].y - currentEnd.y);
                    const dist1 = Math.hypot(seg[1].x - currentEnd.x, seg[1].y - currentEnd.y);

                    if (dist0 < 0.01) {
                        contour.push(seg[1]);
                        currentEnd = seg[1];
                        visited.add(nKey);
                        startX = nx;
                        startY = ny;
                        foundNext = true;
                        break;
                    } else if (dist1 < 0.01) {
                        contour.push(seg[0]);
                        currentEnd = seg[0];
                        visited.add(nKey);
                        startX = nx;
                        startY = ny;
                        foundNext = true;
                        break;
                    }
                }

                if (foundNext) break;
            }
        }

        return contour;
    }

    // Find all contour starting points
    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;

            const segments = getSegments(x, y);
            for (const seg of segments) {
                if (!visited.has(key)) {
                    const contour = traceContour(x, y, seg);
                    if (contour.length >= 3) {
                        contours.push(contour);
                    }
                }
            }
        }
    }

    return contours;
}

/**
 * Generate a signed distance field for contours
 * @param {number} width - Field width
 * @param {number} height - Field height
 * @param {Array<Array<{x: number, y: number}>>} contours - Contour polylines
 * @returns {Float32Array} Signed distance field
 */
export function generateSDF(width, height, contours) {
    const sdf = new Float32Array(width * height);
    sdf.fill(Infinity);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let minDist = Infinity;

            for (const contour of contours) {
                for (let i = 0; i < contour.length - 1; i++) {
                    const dist = pointToSegmentDistance(
                        x, y,
                        contour[i].x, contour[i].y,
                        contour[i + 1].x, contour[i + 1].y
                    );
                    minDist = Math.min(minDist, dist);
                }
            }

            sdf[y * width + x] = minDist;
        }
    }

    return sdf;
}

/**
 * Distance from point to line segment
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
        t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    }

    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    return Math.hypot(px - nearX, py - nearY);
}
