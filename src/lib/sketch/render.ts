import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Options } from "roughjs/bin/core";
import type { Point } from "./geometry";
import { outline, type SketchElement } from "./elements";

const ARROW_HEAD_ANGLE = 0.45;

export function drawElement(rc: RoughCanvas, ctx: CanvasRenderingContext2D, el: SketchElement) {
    const { color, strokeWidth, roughness, seed } = el.style;
    const options: Options = { stroke: color, strokeWidth, roughness, seed };

    switch (el.kind) {
        case "line":
            rc.line(el.x1, el.y1, el.x2, el.y2, options);
            break;
        case "arrow": {
            rc.line(el.x1, el.y1, el.x2, el.y2, options);
            const length = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
            const head = Math.min(Math.max(12, 4 * strokeWidth), 0.35 * length);
            const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
            const barb = (side: number): [number, number] => [
                el.x2 - head * Math.cos(angle + side * ARROW_HEAD_ANGLE),
                el.y2 - head * Math.sin(angle + side * ARROW_HEAD_ANGLE),
            ];
            rc.linearPath([barb(1), [el.x2, el.y2], barb(-1)], options);
            break;
        }
        case "ellipse":
            rc.ellipse(el.cx, el.cy, el.rx * 2, el.ry * 2, options);
            break;
        case "rectangle":
            rc.rectangle(el.x, el.y, el.width, el.height, options);
            break;
        case "diamond":
        case "triangle":
            rc.polygon(outline(el)!.map((p): [number, number] => [p.x, p.y]), options);
            break;
        case "freehand":
            drawSmoothStroke(ctx, el.points, color, strokeWidth);
            break;
    }
}

/** Plain (non-rough) stroke smoothed with quadratic curves through segment midpoints. */
export function drawSmoothStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
    if (points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
    }
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const mx = (points[i].x + points[i + 1].x) / 2;
        const my = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
}
