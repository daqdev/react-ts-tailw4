import type { LearnedChar } from "./characters";

const STORAGE_KEY = "oktools.smartCanvas.learnedChars.v1";
/** Oldest corrections are dropped past this, so storage and matching time stay bounded. */
const MAX_SAMPLES = 300;

const isLearnedChar = (v: unknown): v is LearnedChar =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as LearnedChar).char === "string" &&
    Array.isArray((v as LearnedChar).strokes);

/** Corrections saved in this browser. Storage can be missing or blocked, so every access is guarded. */
export function loadLearned(): LearnedChar[] {
    try {
        const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        return Array.isArray(data) ? data.filter(isLearnedChar) : [];
    } catch {
        return [];
    }
}

export function saveLearned(samples: LearnedChar[]): LearnedChar[] {
    const kept = samples.slice(-MAX_SAMPLES);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
        // Storage full or blocked: the corrections still apply for this session.
    }
    return kept;
}

/** Rounds coordinates so stored samples stay small. */
export const compactStrokes = (strokes: LearnedChar["strokes"]) =>
    strokes.map((s) => s.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })));
