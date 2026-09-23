import {
    bounds,
    diagonal,
    distance,
    distanceToSegment,
    pathLength,
    resample,
    simplify,
    turnAngle,
    type Bounds,
    type Point,
} from "./geometry";

export type Shape =
    | { kind: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number }
    | { kind: "rectangle" | "diamond"; x: number; y: number; width: number; height: number }
    | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
    | { kind: "triangle"; points: [Point, Point, Point] };

export type ShapeName = "line" | "arrow" | "rectangle" | "square" | "ellipse" | "circle" | "diamond" | "triangle";

export interface Recognition {
    shape: Shape;
    name: ShapeName;
    /** 0.5 (barely passed the threshold) .. 1 (perfect fit). */
    score: number;
}

const RESAMPLE_POINTS = 64;
/** Strokes whose bounding-box diagonal is smaller than this are dots/taps, not shapes. */
const MIN_SIZE = 12;
const LINE_MIN_STRAIGHTNESS = 0.9;
/** Fit errors are relative to the stroke's bounding-box diagonal. */
const MAX_ELLIPSE_ERROR = 0.06;
const MAX_POLYGON_ERROR = 0.05;
const ANGLE_SNAP = Math.PI / 4;
const ANGLE_SNAP_TOLERANCE = (8 * Math.PI) / 180;

/** Maps a value between `threshold` (score 0.5) and `ideal` (score 1). */
function confidence(value: number, threshold: number, ideal: number): number {
    const t = (value - threshold) / (ideal - threshold);
    return 0.5 + 0.5 * Math.max(0, Math.min(1, t));
}

/** Snaps the segment's angle to a multiple of 45° when it's close, keeping `a` and the length. */
export function snapSegment(a: Point, b: Point): [Point, Point] {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const snapped = Math.round(angle / ANGLE_SNAP) * ANGLE_SNAP;
    if (Math.abs(angle - snapped) > ANGLE_SNAP_TOLERANCE) return [a, b];
    const length = distance(a, b);
    return [a, { x: a.x + length * Math.cos(snapped), y: a.y + length * Math.sin(snapped) }];
}

function segmentShape(kind: "line" | "arrow", a: Point, b: Point): Shape {
    const [p1, p2] = snapSegment(a, b);
    return { kind, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/**
 * Tries to turn a single freehand stroke into a clean shape.
 * Returns null when nothing fits well enough — the caller should keep the stroke as drawn.
 */
export function recognizeShape(stroke: Point[]): Recognition | null {
    if (stroke.length < 2) return null;
    const box = bounds(stroke);
    const diag = diagonal(box);
    if (diag < MIN_SIZE) return null;

    const points = resample(stroke, RESAMPLE_POINTS);
    const length = pathLength(points);
    const gap = distance(points[0], points[points.length - 1]);
    // A closed outline walks at least ~2 diagonals (a thin rectangle) — this rules out a
    // line drawn back and forth, whose ends can also land close together.
    const isClosed = gap < Math.max(MIN_SIZE, 0.2 * diag) && length > 1.8 * diag;

    return isClosed ? recognizeClosed(points, box, diag) : recognizeOpen(points, length, diag);
}

function recognizeOpen(points: Point[], length: number, diag: number): Recognition | null {
    const arrow = detectSingleStrokeArrow(points, diag);
    if (arrow) return arrow;

    const first = points[0];
    const last = points[points.length - 1];
    const straightness = distance(first, last) / length;
    if (straightness >= LINE_MIN_STRAIGHTNESS) {
        return {
            shape: segmentShape("line", first, last),
            name: "line",
            score: confidence(straightness, LINE_MIN_STRAIGHTNESS, 1),
        };
    }
    return null;
}

/**
 * An arrow drawn in one go: a long straight shaft followed (or preceded) by a short head
 * whose barbs point back towards the tail.
 */
function detectSingleStrokeArrow(points: Point[], diag: number): Recognition | null {
    const vertices = simplify(points, 0.06 * diag);
    if (vertices.length < 3) return null;

    const tryShaftFirst = (v: Point[]): Recognition | null => {
        const [tail, tip, ...head] = v;
        const shaft = distance(tail, tip);
        if (shaft < 0.6 * diag) return null;
        if (!head.every((p) => distance(p, tip) < 0.45 * shaft)) return null;

        const dirX = (tip.x - tail.x) / shaft;
        const dirY = (tip.y - tail.y) / shaft;
        const goesBack = head.some((p) => (p.x - tip.x) * dirX + (p.y - tip.y) * dirY < -0.05 * shaft);
        if (!goesBack) return null;

        return { shape: segmentShape("arrow", tail, tip), name: "arrow", score: 0.9 };
    };

    return tryShaftFirst(vertices) ?? tryShaftFirst([...vertices].reverse());
}

function recognizeClosed(points: Point[], box: Bounds, diag: number): Recognition | null {
    const ellipseError = ellipseFitError(points, box) / diag;
    const polygon = polygonVertices(points, diag);
    const polygonError = polygon ? polygonFitError(points, polygon) / diag : Infinity;

    if (ellipseError <= polygonError && ellipseError < MAX_ELLIPSE_ERROR) {
        const score = confidence(ellipseError, MAX_ELLIPSE_ERROR, 0);
        const cx = box.minX + box.width / 2;
        const cy = box.minY + box.height / 2;
        const aspect = box.width / Math.max(1, box.height);
        if (aspect > 0.8 && aspect < 1.25) {
            const r = (box.width + box.height) / 4;
            return { shape: { kind: "ellipse", cx, cy, rx: r, ry: r }, name: "circle", score };
        }
        return { shape: { kind: "ellipse", cx, cy, rx: box.width / 2, ry: box.height / 2 }, name: "ellipse", score };
    }

    if (!polygon || polygonError >= MAX_POLYGON_ERROR) return null;
    const score = confidence(polygonError, MAX_POLYGON_ERROR, 0);

    if (polygon.length === 3) {
        return { shape: { kind: "triangle", points: [polygon[0], polygon[1], polygon[2]] }, name: "triangle", score };
    }

    // Four corners: an axis-aligned box has them near the bounding-box corners,
    // a diamond near the middle of its edges.
    const vb = bounds(polygon);
    const cx = vb.minX + vb.width / 2;
    const cy = vb.minY + vb.height / 2;
    const boxCorners = [
        { x: vb.minX, y: vb.minY }, { x: vb.maxX, y: vb.minY },
        { x: vb.maxX, y: vb.maxY }, { x: vb.minX, y: vb.maxY },
    ];
    const edgeMids = [
        { x: cx, y: vb.minY }, { x: vb.maxX, y: cy },
        { x: cx, y: vb.maxY }, { x: vb.minX, y: cy },
    ];
    const nearest = (p: Point, targets: Point[]) => Math.min(...targets.map((t) => distance(p, t)));
    const cornerFit = polygon.reduce((sum, p) => sum + nearest(p, boxCorners), 0);
    const midFit = polygon.reduce((sum, p) => sum + nearest(p, edgeMids), 0);

    const rect = { x: vb.minX, y: vb.minY, width: vb.width, height: vb.height };
    if (midFit < cornerFit) {
        return { shape: { kind: "diamond", ...rect }, name: "diamond", score };
    }

    const aspect = vb.width / Math.max(1, vb.height);
    if (aspect > 0.85 && aspect < 1.18) {
        const side = (vb.width + vb.height) / 2;
        return {
            shape: { kind: "rectangle", x: cx - side / 2, y: cy - side / 2, width: side, height: side },
            name: "square",
            score,
        };
    }
    return { shape: { kind: "rectangle", ...rect }, name: "rectangle", score };
}

/** Mean distance from the stroke to the ellipse inscribed in its bounding box. */
function ellipseFitError(points: Point[], box: Bounds): number {
    const rx = Math.max(1, box.width / 2);
    const ry = Math.max(1, box.height / 2);
    const cx = box.minX + box.width / 2;
    const cy = box.minY + box.height / 2;
    let total = 0;
    for (const p of points) {
        const theta = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
        total += distance(p, { x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
    }
    return total / points.length;
}

/** Mean distance from the stroke to the closed polygon. */
function polygonFitError(points: Point[], polygon: Point[]): number {
    let total = 0;
    for (const p of points) {
        let best = Infinity;
        for (let i = 0; i < polygon.length; i++) {
            best = Math.min(best, distanceToSegment(p, polygon[i], polygon[(i + 1) % polygon.length]));
        }
        total += best;
    }
    return total / points.length;
}

/**
 * Corners of a closed stroke, or null unless it reduces to a triangle or quadrilateral.
 * Simplifies the outline, then drops vertices that are nearly straight or crowd a neighbour
 * (the closing overlap and a start point in the middle of an edge produce those).
 */
function polygonVertices(points: Point[], diag: number): Point[] | null {
    const vertices = simplify(points, 0.07 * diag);
    // Start and end sit next to each other on a closed stroke.
    vertices.pop();

    const minSide = 0.12 * diag;
    const minTurn = (25 * Math.PI) / 180;
    let changed = true;
    while (changed && vertices.length > 3) {
        changed = false;
        for (let i = 0; i < vertices.length; i++) {
            const prev = vertices[(i - 1 + vertices.length) % vertices.length];
            const curr = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            if (distance(prev, curr) < minSide || turnAngle(prev, curr, next) < minTurn) {
                vertices.splice(i, 1);
                changed = true;
                break;
            }
        }
    }
    return vertices.length === 3 || vertices.length === 4 ? vertices : null;
}

/**
 * Checks whether `stroke` is an arrowhead drawn separately at one end of an existing line.
 * Returns the arrow's endpoints (tail → tip) or null.
 */
export function tryAttachArrowHead(
    line: { x1: number; y1: number; x2: number; y2: number },
    stroke: Point[],
): { x1: number; y1: number; x2: number; y2: number } | null {
    const p1 = { x: line.x1, y: line.y1 };
    const p2 = { x: line.x2, y: line.y2 };
    const lineLength = distance(p1, p2);
    if (lineLength < 20 || stroke.length < 2) return null;

    const box = bounds(stroke);
    const headSize = diagonal(box);
    if (headSize < 4 || headSize > 0.6 * lineLength) return null;

    const centroid = {
        x: stroke.reduce((s, p) => s + p.x, 0) / stroke.length,
        y: stroke.reduce((s, p) => s + p.y, 0) / stroke.length,
    };
    const reach = Math.max(15, 0.5 * headSize);

    let best: { tail: Point; tip: Point; gap: number } | null = null;
    for (const [tail, tip] of [[p1, p2], [p2, p1]]) {
        const gap = Math.min(...stroke.map((p) => distance(p, tip)));
        if (gap > reach) continue;
        // The barbs trail back along the shaft, so the head's centre sits behind the tip.
        const behind = (centroid.x - tip.x) * (tip.x - tail.x) + (centroid.y - tip.y) * (tip.y - tail.y) < 0;
        if (!behind) continue;
        if (!best || gap < best.gap) best = { tail, tip, gap };
    }
    if (!best) return null;
    return { x1: best.tail.x, y1: best.tail.y, x2: best.tip.x, y2: best.tip.y };
}
