/**
 * Built-in templates for digits and uppercase letters, described as clean pen strokes in a box
 * about 0.6 wide by 1 tall (y grows downwards). Characters with common alternative ways of
 * writing them get more than one entry. Corrections made by the user are added on top of these.
 */
import type { Point } from "./geometry";

type Stroke = Point[];

const p = (x: number, y: number): Point => ({ x, y });
const path = (...coords: [number, number][]): Stroke => coords.map(([x, y]) => p(x, y));

/** Elliptical arc; angles in degrees, 0° = right, 90° = down. Goes from `from` to `to` in either direction. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Stroke {
    const steps = Math.max(8, Math.ceil(Math.abs(to - from) / 12));
    return Array.from({ length: steps + 1 }, (_, i) => {
        const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
        return p(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    });
}

/** Joins pieces into one continuous stroke. */
const join = (...pieces: Stroke[]): Stroke => pieces.flat();

export const DEFAULT_GLYPHS: [string, Stroke[]][] = [
    ["0", [arc(0.28, 0.5, 0.28, 0.5, -90, 270)]],
    ["1", [path([0.3, 0], [0.3, 1])]],
    ["1", [path([0.1, 0.2], [0.3, 0], [0.3, 1])]],
    ["2", [join(arc(0.3, 0.28, 0.28, 0.28, 200, 400), path([0, 1], [0.6, 1]))]],
    ["3", [join(arc(0.3, 0.25, 0.26, 0.25, 200, 450), arc(0.3, 0.75, 0.28, 0.25, 270, 520))]],
    ["4", [path([0.45, 1], [0.45, 0], [0, 0.7], [0.6, 0.7])]],
    ["4", [path([0.3, 0], [0, 0.7], [0.6, 0.7]), path([0.45, 0.3], [0.45, 1])]],
    ["5", [join(path([0.55, 0], [0.08, 0], [0.05, 0.45]), arc(0.28, 0.68, 0.3, 0.32, 225, 510))]],
    ["6", [join(path([0.5, 0.02], [0.25, 0.2], [0.05, 0.55]), arc(0.3, 0.72, 0.27, 0.28, 180, 540))]],
    ["7", [path([0, 0], [0.6, 0], [0.2, 1])]],
    ["8", [arc(0.3, 0.25, 0.22, 0.25, 0, 360), arc(0.3, 0.74, 0.28, 0.26, 0, 360)]],
    ["9", [join(arc(0.3, 0.3, 0.28, 0.3, 0, 360), path([0.58, 0.3], [0.52, 1]))]],

    ["A", [path([0, 1], [0.3, 0], [0.6, 1]), path([0.12, 0.6], [0.48, 0.6])]],
    ["B", [path([0, 0], [0, 1]), join(path([0, 0], [0.3, 0]), arc(0.3, 0.25, 0.25, 0.25, 270, 450), path([0, 0.5], [0.33, 0.5]), arc(0.33, 0.75, 0.26, 0.25, 270, 450), path([0, 1]))]],
    ["C", [arc(0.35, 0.5, 0.35, 0.5, -40, -320)]],
    ["D", [path([0, 0], [0, 1]), join(path([0, 0], [0.15, 0]), arc(0.15, 0.5, 0.45, 0.5, 270, 450), path([0, 1]))]],
    ["E", [path([0.55, 0], [0, 0], [0, 1], [0.55, 1]), path([0, 0.5], [0.45, 0.5])]],
    ["F", [path([0.55, 0], [0, 0], [0, 1]), path([0, 0.5], [0.45, 0.5])]],
    ["G", [join(arc(0.35, 0.5, 0.35, 0.5, -40, -360), path([0.4, 0.5]))]],
    ["H", [path([0, 0], [0, 1]), path([0.6, 0], [0.6, 1]), path([0, 0.5], [0.6, 0.5])]],
    ["I", [path([0.1, 0], [0.5, 0]), path([0.3, 0], [0.3, 1]), path([0.1, 1], [0.5, 1])]],
    ["J", [join(path([0.55, 0], [0.55, 0.7]), arc(0.3, 0.7, 0.25, 0.3, 0, 170))]],
    ["K", [path([0, 0], [0, 1]), path([0.55, 0], [0, 0.55], [0.6, 1])]],
    ["L", [path([0, 0], [0, 1], [0.55, 1])]],
    ["M", [path([0, 1], [0, 0], [0.3, 0.6], [0.6, 0], [0.6, 1])]],
    ["N", [path([0, 1], [0, 0], [0.6, 1], [0.6, 0])]],
    ["O", [arc(0.45, 0.5, 0.45, 0.5, -90, 270)]],
    ["P", [path([0, 0], [0, 1]), join(path([0, 0], [0.3, 0]), arc(0.3, 0.25, 0.28, 0.25, 270, 450), path([0, 0.5]))]],
    ["Q", [arc(0.45, 0.5, 0.45, 0.5, -90, 270), path([0.55, 0.7], [0.9, 1.05])]],
    ["R", [path([0, 0], [0, 1]), join(path([0, 0], [0.3, 0]), arc(0.3, 0.25, 0.28, 0.25, 270, 450), path([0, 0.5], [0.6, 1]))]],
    ["S", [join(arc(0.3, 0.25, 0.28, 0.25, -20, -270), arc(0.3, 0.75, 0.28, 0.25, -90, 160))]],
    ["T", [path([0, 0], [0.6, 0]), path([0.3, 0], [0.3, 1])]],
    ["U", [join(path([0, 0], [0, 0.7]), arc(0.3, 0.7, 0.3, 0.3, 180, 0), path([0.6, 0]))]],
    ["V", [path([0, 0], [0.3, 1], [0.6, 0])]],
    ["W", [path([0, 0], [0.15, 1], [0.3, 0.4], [0.45, 1], [0.6, 0])]],
    ["X", [path([0, 0], [0.6, 1]), path([0.6, 0], [0, 1])]],
    ["Y", [path([0, 0], [0.3, 0.5], [0.6, 0]), path([0.3, 0.5], [0.3, 1])]],
    ["Z", [path([0, 0], [0.6, 0], [0, 1], [0.6, 1])]],
];
