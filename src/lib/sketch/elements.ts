import { bounds, distance, distanceToSegment, type Point } from "./geometry";
import type { ColorKey } from "./palette";
import type { Shape } from "./shapes";

export interface ElementStyle {
    color: ColorKey;
    strokeWidth: number;
    roughness: number;
    /** Fixed seed so rough.js draws the same wobble on every redraw. */
    seed: number;
}

/** One recognized character, keeping the ink it came from so it can be corrected or reverted. */
export interface Glyph {
    char: string;
    strokes: Point[][];
    alternatives: string[];
    /** Recognition confidence, 0.5..1 (1 for spaces and user corrections). */
    score: number;
}

export type SketchElement = { id: number; style: ElementStyle; raw?: Point[][] } & (
    | Shape
    | { kind: "freehand"; points: Point[] }
    /** `x` is the left edge and `y` the baseline. */
    | { kind: "text"; x: number; y: number; fontSize: number; glyphs: Glyph[] }
);

type TextElement = Extract<SketchElement, { kind: "text" }>;

/** Average advance of the handwriting-style font, as a fraction of the font size. */
const CHAR_ADVANCE = 0.62;

export const textOf = (el: TextElement) => el.glyphs.map((g) => g.char).join("");

/** Approximate box of a text element (no canvas needed to measure). */
export function textBox(el: TextElement) {
    return {
        minX: el.x,
        minY: el.y - 0.8 * el.fontSize,
        maxX: el.x + CHAR_ADVANCE * el.fontSize * el.glyphs.length,
        maxY: el.y + 0.2 * el.fontSize,
    };
}

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
        case "text": {
            const box = textBox(el);
            const dx = Math.max(box.minX - p.x, 0, p.x - box.maxX);
            const dy = Math.max(box.minY - p.y, 0, p.y - box.maxY);
            return Math.hypot(dx, dy);
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

/** Bottom-right corner of the area covered by the elements (including stroke width). */
export function contentExtent(elements: SketchElement[]): { maxX: number; maxY: number } {
    let maxX = 0;
    let maxY = 0;
    for (const el of elements) {
        let points: Point[];
        switch (el.kind) {
            case "line":
            case "arrow":
                points = [{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }];
                break;
            case "ellipse":
                points = [{ x: el.cx + el.rx, y: el.cy + el.ry }];
                break;
            case "freehand":
                points = el.points;
                break;
            case "text": {
                const box = textBox(el);
                points = [{ x: box.maxX, y: box.maxY }];
                break;
            }
            default:
                points = outline(el)!;
        }
        const b = bounds(points);
        maxX = Math.max(maxX, b.maxX + el.style.strokeWidth);
        maxY = Math.max(maxY, b.maxY + el.style.strokeWidth);
    }
    return { maxX, maxY };
}

/** Topmost element whose outline passes within `tolerance` of `p`. */
export function hitTest(elements: SketchElement[], p: Point, tolerance: number): SketchElement | null {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (distanceToElement(el, p) <= tolerance + el.style.strokeWidth / 2) return el;
    }
    return null;
}
