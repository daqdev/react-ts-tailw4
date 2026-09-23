export interface Point {
    x: number;
    y: number;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += distance(points[i - 1], points[i]);
    }
    return length;
}

export function bounds(points: Point[]): Bounds {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export const diagonal = (b: Bounds) => Math.hypot(b.width, b.height);

/**
 * Resamples a stroke into `n` points evenly spaced along its path (as in the $1 recognizer),
 * so later analysis doesn't depend on how fast the user drew.
 */
export function resample(points: Point[], n: number): Point[] {
    if (points.length === 0) return [];
    const interval = pathLength(points) / (n - 1);
    if (interval === 0) return Array.from({ length: n }, () => ({ ...points[0] }));

    const result: Point[] = [{ ...points[0] }];
    let accumulated = 0;
    let prev = points[0];
    for (let i = 1; i < points.length; i++) {
        const curr = points[i];
        let d = distance(prev, curr);
        while (accumulated + d >= interval && d > 0) {
            const t = (interval - accumulated) / d;
            const q = { x: prev.x + t * (curr.x - prev.x), y: prev.y + t * (curr.y - prev.y) };
            result.push(q);
            prev = q;
            d = distance(prev, curr);
            accumulated = 0;
        }
        accumulated += d;
        prev = curr;
    }
    // Rounding can leave us one point short.
    while (result.length < n) result.push({ ...points[points.length - 1] });
    return result.slice(0, n);
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return distance(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker polyline simplification. Keeps the first and last points. */
export function simplify(points: Point[], epsilon: number): Point[] {
    if (points.length < 3) return points.slice();
    const keep = new Array<boolean>(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [start, end] = stack.pop()!;
        let maxDist = 0;
        let index = -1;
        for (let i = start + 1; i < end; i++) {
            const d = distanceToSegment(points[i], points[start], points[end]);
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }
        if (index !== -1 && maxDist > epsilon) {
            keep[index] = true;
            stack.push([start, index], [index, end]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

/** Absolute turning angle (radians, 0..π) at `b` when walking a → b → c. */
export function turnAngle(a: Point, b: Point, c: Point): number {
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return diff;
}
