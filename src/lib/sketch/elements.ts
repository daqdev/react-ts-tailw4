import { distance, distanceToSegment, type Point } from "./geometry";
import type { Shape } from "./shapes";

export interface ElementStyle {
    color: string;
    strokeWidth: number;
    roughness: number;
    /** Fixed seed so rough.js draws the same wobble on every redraw. */
    seed: number;
}

export type SketchElement = { id: number; style: ElementStyle; raw?: Point[][] } & (
    | Shape
    | { kind: "freehand"; points: Point[] }
);

/** Outline of a polygon-like element as a closed list of vertices, or null for other kinds. */
export function outline(el: SketchElement): Point[] | null {
    switch (el.kind) {
        case "rectangle":
            return [
                { x: el.x, y: el.y }, { x: el.x + el.width, y: el.y },
                { x: el.x + el.width, y: el.y + el.height }, { x: el.x, y: el.y + el.height },
            ];
        case "diamond": {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            return [
                { x: cx, y: el.y }, { x: el.x + el.width, y: cy },
                { x: cx, y: el.y + el.height }, { x: el.x, y: cy },
            ];
        }
        case "triangle":
            return el.points;
        default:
            return null;
    }
}

/** Distance from `p` to the drawn outline of the element. */
export function distanceToElement(el: SketchElement, p: Point): number {
    switch (el.kind) {
        case "line":
        case "arrow":
            return distanceToSegment(p, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 });
        case "ellipse": {
            const rx = Math.max(1, el.rx);
            const ry = Math.max(1, el.ry);
            const theta = Math.atan2((p.y - el.cy) / ry, (p.x - el.cx) / rx);
            return distance(p, { x: el.cx + rx * Math.cos(theta), y: el.cy + ry * Math.sin(theta) });
        }
        case "freehand": {
            if (el.points.length === 1) return distance(p, el.points[0]);
            let best = Infinity;
            for (let i = 1; i < el.points.length; i++) {
                best = Math.min(best, distanceToSegment(p, el.points[i - 1], el.points[i]));
            }
            return best;
        }
        default: {
            const vertices = outline(el)!;
            let best = Infinity;
            for (let i = 0; i < vertices.length; i++) {
                best = Math.min(best, distanceToSegment(p, vertices[i], vertices[(i + 1) % vertices.length]));
            }
            return best;
        }
    }
}

/** Topmost element whose outline passes within `tolerance` of `p`. */
export function hitTest(elements: SketchElement[], p: Point, tolerance: number): SketchElement | null {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (distanceToElement(el, p) <= tolerance + el.style.strokeWidth / 2) return el;
    }
    return null;
}
