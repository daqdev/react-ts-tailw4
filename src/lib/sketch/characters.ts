import { bounds, type Bounds, type Point } from "./geometry";
import { DEFAULT_GLYPHS } from "./glyphs";
import { createPointCloud, rankMatches, type PointCloud } from "./pointCloud";

export interface LearnedChar {
    char: string;
    strokes: Point[][];
}

export interface CharResult {
    char: string;
    /** $Q distance to the best template; lower is better. */
    distance: number;
    /** 0.5 (tie with the runner-up) .. 1 (clear winner). */
    score: number;
    /** Next best distinct characters, best first. */
    alternatives: string[];
}

/**
 * $Q distances above this are scribbles or shapes rather than characters (measured: characters
 * land around 0.4–9, random scribbles around 13–19).
 */
const MAX_CHAR_DISTANCE = 10;
const ALTERNATIVES = 4;

let defaultTemplates: PointCloud[] | null = null;

export interface CharRecognizer {
    recognize(strokes: Point[][]): CharResult | null;
    learn(sample: LearnedChar): void;
}

/** Built-in templates (built once, ~30 ms) plus the user's learned corrections. */
export function createCharRecognizer(learned: LearnedChar[]): CharRecognizer {
    defaultTemplates ??= DEFAULT_GLYPHS.map(([char, strokes]) => createPointCloud(char, strokes));
    const templates = [...defaultTemplates, ...learned.map((l) => createPointCloud(l.char, l.strokes))];

    return {
        recognize(strokes) {
            const ranked = rankMatches(strokes, templates);
            if (ranked.length === 0 || ranked[0].distance > MAX_CHAR_DISTANCE) return null;
            const [best, second] = ranked;
            const margin = second ? 1 - best.distance / Math.max(second.distance, 1e-9) : 1;
            return {
                char: best.name,
                distance: best.distance,
                score: 0.5 + 0.5 * Math.max(0, Math.min(1, margin)),
                alternatives: ranked.slice(1, 1 + ALTERNATIVES).map((m) => m.name),
            };
        },
        learn(sample) {
            templates.push(createPointCloud(sample.char, sample.strokes));
        },
    };
}

export const strokesBounds = (strokes: Point[][]): Bounds => bounds(strokes.flat());

/**
 * Whether a new stroke belongs to the character being written: its horizontal extent must
 * overlap the group's. Thin strokes (a '1', the stem of a 'T') get a minimum width so a
 * crossbar or a second stroke next to them still counts as overlapping.
 */
export function strokeJoinsGroup(group: Bounds, stroke: Bounds): boolean {
    const minWidth = 0.25 * Math.max(group.height, stroke.height, 10);
    const expand = (b: Bounds) => {
        const extra = Math.max(0, minWidth - b.width) / 2;
        return { min: b.minX - extra, max: b.maxX + extra, width: Math.max(b.width, minWidth) };
    };
    const a = expand(group);
    const b = expand(stroke);
    const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min);
    return overlap >= 0.5 * Math.min(a.width, b.width);
}

export interface Segment {
    strokes: Point[][];
    box: Bounds;
    result: CharResult | null;
}

/** Most stroke clusters that can make up one character (e.g. 'H' is three separate strokes). */
const MAX_CLUSTERS_PER_CHAR = 4;
/** Added per character so that, all else equal, fewer and more complete characters win. */
const CHAR_PENALTY = 1.5;
/** Cost of a segment that matches nothing, so the split still completes. */
const UNRECOGNIZED_COST = 2 * MAX_CHAR_DISTANCE;
/** Wider than this (relative to height) can't be a single character. */
const MAX_CHAR_ASPECT = 1.4;
/** Above this many clusters, skip the search and take each cluster as a character. */
const MAX_CLUSTERS_TO_SEARCH = 12;

/**
 * Splits everything written before a pause into characters, left to right.
 *
 * Strokes whose horizontal extents overlap always belong together (the bar of a 'T', the two
 * strokes of an 'X'); those clusters are then grouped into characters by trying every way to
 * split them and keeping the one with the lowest total recognition distance. This is what lets
 * 'H' (three clusters) and "DB" written without a pause (two clusters) both come out right.
 */
export function segmentCharacters(strokes: Point[][], recognizer: CharRecognizer): Segment[] {
    const clusters = clusterStrokes(strokes);
    const segment = (group: Point[][][]): Segment => {
        const merged = group.flat();
        return { strokes: merged, box: strokesBounds(merged), result: recognizer.recognize(merged) };
    };
    if (clusters.length > MAX_CLUSTERS_TO_SEARCH) return clusters.map((c) => segment([c]));

    const n = clusters.length;
    const best: { cost: number; from: number; segment: Segment | null }[] = [{ cost: 0, from: 0, segment: null }];
    for (let j = 1; j <= n; j++) {
        best[j] = { cost: Infinity, from: j - 1, segment: null };
        for (let i = Math.max(1, j - MAX_CLUSTERS_PER_CHAR + 1); i <= j; i++) {
            const group = clusters.slice(i - 1, j);
            if (i < j) {
                const box = strokesBounds(group.flat());
                if (box.width > MAX_CHAR_ASPECT * Math.max(box.height, 10)) continue;
            }
            const candidate = segment(group);
            const cost = best[i - 1].cost + (candidate.result?.distance ?? UNRECOGNIZED_COST) + CHAR_PENALTY;
            if (cost < best[j].cost) best[j] = { cost, from: i - 1, segment: candidate };
        }
    }

    const segments: Segment[] = [];
    for (let j = n; j > 0; j = best[j].from) segments.unshift(best[j].segment!);
    return segments;
}

/** Groups strokes whose horizontal extents overlap; clusters come back ordered left to right. */
function clusterStrokes(strokes: Point[][]): Point[][][] {
    const boxes = strokes.map((s) => bounds(s));
    const parent = strokes.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < strokes.length; i++) {
        for (let j = i + 1; j < strokes.length; j++) {
            if (strokeJoinsGroup(boxes[i], boxes[j])) parent[find(i)] = find(j);
        }
    }
    const groups = new Map<number, Point[][]>();
    strokes.forEach((s, i) => {
        const root = find(i);
        groups.set(root, [...(groups.get(root) ?? []), s]);
    });
    return [...groups.values()].sort((a, b) => strokesBounds(a).minX - strokesBounds(b).minX);
}

/**
 * How a new character relates to the previous one: part of the same word (optionally after a
 * space) or the start of a new text.
 */
export function followsCharacter(prev: Bounds, next: Bounds): "same-word" | "after-space" | null {
    const height = Math.max(prev.height, next.height, 10);
    const verticalOverlap = Math.min(prev.maxY, next.maxY) - Math.max(prev.minY, next.minY);
    if (verticalOverlap < 0.4 * Math.min(prev.height, next.height)) return null;
    if (next.minX < prev.minX + 0.3 * prev.width) return null;
    const gap = next.minX - prev.maxX;
    if (gap > 1.3 * height) return null;
    return gap > 0.55 * height ? "after-space" : "same-word";
}
