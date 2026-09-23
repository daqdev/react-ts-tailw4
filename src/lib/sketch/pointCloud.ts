/**
 * $Q point-cloud recognizer (Vatavu, Anthony & Wobbrock, 2018).
 *
 * Compares a multistroke gesture against stored templates as unordered point clouds, so it
 * doesn't care about stroke order, stroke direction or how many strokes were used. No training
 * step: adding a template is just storing another normalized cloud.
 */
import type { Point } from "./geometry";

const NUM_POINTS = 32;
const MAX_INT_COORD = 1024;
const LUT_SIZE = 64;
const LUT_SCALE = MAX_INT_COORD / LUT_SIZE;

interface CloudPoint {
    x: number;
    y: number;
    stroke: number;
    intX: number;
    intY: number;
}

export interface PointCloud {
    name: string;
    points: CloudPoint[];
    lut: number[][];
}

export interface Match {
    name: string;
    /** Weighted point-matching distance; lower is better. */
    distance: number;
}

export function createPointCloud(name: string, strokes: Point[][]): PointCloud {
    const raw: CloudPoint[] = [];
    strokes.forEach((stroke, s) => {
        for (const p of stroke) raw.push({ x: p.x, y: p.y, stroke: s, intX: 0, intY: 0 });
    });
    const points = makeIntCoords(translateToOrigin(scale(resample(raw, NUM_POINTS))));
    return { name, points, lut: computeLut(points) };
}

/**
 * Best distance per template name, sorted best first. Each name's search is cut short as soon
 * as it can't beat that name's best so far, which keeps this fast with many templates.
 */
export function rankMatches(strokes: Point[][], templates: PointCloud[]): Match[] {
    if (templates.length === 0 || strokes.every((s) => s.length === 0)) return [];
    const candidate = createPointCloud("", strokes);
    const best = new Map<string, number>();
    for (const template of templates) {
        const bound = best.get(template.name) ?? Infinity;
        const d = cloudMatch(candidate, template, bound);
        if (d < bound) best.set(template.name, d);
    }
    return [...best.entries()].map(([name, distance]) => ({ name, distance })).sort((a, b) => a.distance - b.distance);
}

function cloudMatch(candidate: PointCloud, template: PointCloud, minSoFar: number): number {
    const n = candidate.points.length;
    const step = Math.floor(Math.sqrt(n));
    const lb1 = computeLowerBound(candidate.points, template.points, step, template.lut);
    const lb2 = computeLowerBound(template.points, candidate.points, step, candidate.lut);
    for (let i = 0, j = 0; i < n; i += step, j++) {
        if (lb1[j] < minSoFar) minSoFar = Math.min(minSoFar, cloudDistance(candidate.points, template.points, i, minSoFar));
        if (lb2[j] < minSoFar) minSoFar = Math.min(minSoFar, cloudDistance(template.points, candidate.points, i, minSoFar));
    }
    return minSoFar;
}

/** Greedy matching starting at `start`; earlier matches weigh more. Abandons once it exceeds minSoFar. */
function cloudDistance(pts1: CloudPoint[], pts2: CloudPoint[], start: number, minSoFar: number): number {
    const n = pts1.length;
    const unmatched = Array.from({ length: n }, (_, k) => k);
    let i = start;
    let weight = n;
    let sum = 0;
    do {
        let u = -1;
        let b = Infinity;
        for (let j = 0; j < unmatched.length; j++) {
            const d = sqrDistance(pts1[i], pts2[unmatched[j]]);
            if (d < b) {
                b = d;
                u = j;
            }
        }
        unmatched.splice(u, 1);
        sum += weight * b;
        if (sum >= minSoFar) return sum;
        weight--;
        i = (i + 1) % n;
    } while (i !== start);
    return sum;
}

function computeLowerBound(pts1: CloudPoint[], pts2: CloudPoint[], step: number, lut: number[][]): number[] {
    const n = pts1.length;
    const lb = new Array<number>(Math.floor(n / step) + 1).fill(0);
    const sat = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        const x = Math.round(pts1[i].intX / LUT_SCALE);
        const y = Math.round(pts1[i].intY / LUT_SCALE);
        const d = sqrDistance(pts1[i], pts2[lut[x][y]]);
        sat[i] = i === 0 ? d : sat[i - 1] + d;
        lb[0] += (n - i) * d;
    }
    for (let i = step, j = 1; i < n; i += step, j++) {
        lb[j] = lb[0] + i * sat[n - 1] - n * sat[i - 1];
    }
    return lb;
}

/** For every cell of a coarse grid, the index of the nearest cloud point. */
function computeLut(points: CloudPoint[]): number[][] {
    const lut: number[][] = [];
    for (let x = 0; x < LUT_SIZE; x++) {
        lut[x] = [];
        for (let y = 0; y < LUT_SIZE; y++) {
            let u = -1;
            let b = Infinity;
            for (let i = 0; i < points.length; i++) {
                const row = Math.round(points[i].intX / LUT_SCALE);
                const col = Math.round(points[i].intY / LUT_SCALE);
                const d = (row - x) * (row - x) + (col - y) * (col - y);
                if (d < b) {
                    b = d;
                    u = i;
                }
            }
            lut[x][y] = u;
        }
    }
    return lut;
}

/** Resamples the concatenated strokes into n points; interpolation never bridges two strokes. */
function resample(points: CloudPoint[], n: number): CloudPoint[] {
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].stroke === points[i - 1].stroke) pathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const interval = pathLength / (n - 1);
    const src = points.slice();
    const result: CloudPoint[] = [{ ...src[0] }];
    if (interval === 0) {
        while (result.length < n) result.push({ ...src[0] });
        return result;
    }

    let accumulated = 0;
    for (let i = 1; i < src.length; i++) {
        if (src[i].stroke !== src[i - 1].stroke) continue;
        const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
        if (accumulated + d >= interval && d > 0) {
            const t = (interval - accumulated) / d;
            const q: CloudPoint = {
                x: src[i - 1].x + t * (src[i].x - src[i - 1].x),
                y: src[i - 1].y + t * (src[i].y - src[i - 1].y),
                stroke: src[i].stroke,
                intX: 0,
                intY: 0,
            };
            result.push(q);
            src.splice(i, 0, q); // q becomes the next segment's start
            accumulated = 0;
        } else {
            accumulated += d;
        }
    }
    // Rounding can leave us one point short.
    while (result.length < n) result.push({ ...src[src.length - 1] });
    return result.slice(0, n);
}

/** Uniform scale into the unit square; keeps the aspect ratio (a '1' stays thin). */
function scale(points: CloudPoint[]): CloudPoint[] {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const size = Math.max(maxX - minX, maxY - minY) || 1;
    return points.map((p) => ({ ...p, x: (p.x - minX) / size, y: (p.y - minY) / size }));
}

function translateToOrigin(points: CloudPoint[]): CloudPoint[] {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return points.map((p) => ({ ...p, x: p.x - cx, y: p.y - cy }));
}

/** Integer grid coordinates for the lookup table (points are within [-1, 1] after normalizing). */
function makeIntCoords(points: CloudPoint[]): CloudPoint[] {
    return points.map((p) => ({
        ...p,
        intX: Math.round(((p.x + 1) / 2) * (MAX_INT_COORD - 1)),
        intY: Math.round(((p.y + 1) / 2) * (MAX_INT_COORD - 1)),
    }));
}

const sqrDistance = (a: CloudPoint, b: CloudPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
