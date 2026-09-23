import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import rough from "roughjs";
import { useTranslation } from "../hooks/useTranslation";
import { bounds, type Bounds, type Point } from "../lib/sketch/geometry";
import { recognizeShape, tryAttachArrowHead, type ShapeName } from "../lib/sketch/shapes";
import { contentExtent, hitTest, type ElementStyle, type Glyph, type SketchElement } from "../lib/sketch/elements";
import { drawElement, drawSmoothStroke } from "../lib/sketch/render";
import { BACKGROUND, COLOR_KEYS, resolveColor, type CanvasTheme, type ColorKey } from "../lib/sketch/palette";
import {
    createCharRecognizer,
    followsCharacter,
    segmentCharacters,
    strokesBounds,
    type CharRecognizer,
    type LearnedChar,
} from "../lib/sketch/characters";
import { compactStrokes, loadLearned, saveLearned } from "../lib/sketch/learnedStore";

type Tool = "shapes" | "text" | "freehand" | "eraser";

interface History {
    past: SketchElement[][];
    present: SketchElement[];
    future: SketchElement[][];
}

type Status =
    | { type: "shape"; name: ShapeName; score: number; elementId: number }
    | { type: "noShape" }
    /** Characters recognized at the last pause; `selected` is the one the correction UI acts on. */
    | { type: "char"; elementId: number; glyphIndices: number[]; selected: number; corrected: number | null }
    | { type: "noChar"; elementIds: number[]; strokes: Point[][] };

type TextElement = Extract<SketchElement, { kind: "text" }>;

/** Strokes written since the last pause (not recognized yet). */
interface PendingGroup {
    strokes: Point[][];
    box: Bounds;
    color: string;
    width: number;
}

/** Height of the drawing area in the normal (card) view. */
const VIEW_HEIGHT = 480;
/** Room kept past the furthest element when the canvas grows to fit its content. */
const CONTENT_MARGIN = 24;
/** A separate stroke counts as the head of the previous line only if drawn within this window. */
const ARROW_HEAD_WINDOW_MS = 4000;
const ERASER_TOLERANCE = 8;
/** Pause after which the strokes written so far are split into characters and recognized. */
const CHAR_PAUSE_MS = 700;
/** A character written within this time right of the previous one continues the same text. */
const WORD_WINDOW_MS = 5000;
/** Cap height of the text font as a fraction of the font size. */
const CAP_HEIGHT = 0.7;

let nextId = 1;
const newId = () => nextId++;
const newSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;

export default function SmartCanvasTool() {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const baseRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    const [view, setView] = useState({ width: 0, height: 0 });
    const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
    const [tool, setTool] = useState<Tool>("shapes");
    const [color, setColor] = useState<ColorKey>("ink");
    const [theme, setTheme] = useState<CanvasTheme>("light");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [roughness, setRoughness] = useState(1);
    const [status, setStatus] = useState<Status | null>(null);
    const [pendingErase, setPendingErase] = useState<Set<number>>(new Set());
    const [learned, setLearned] = useState<LearnedChar[]>(loadLearned);
    const [otherChar, setOtherChar] = useState("");

    const strokeRef = useRef<Point[] | null>(null);
    const erasingRef = useRef(false);
    const lastLineRef = useRef<{ id: number; at: number } | null>(null);
    const pendingRef = useRef<PendingGroup | null>(null);
    const pauseTimerRef = useRef<number | undefined>(undefined);
    const lastGlyphRef = useRef<{ elementId: number; box: Bounds; at: number } | null>(null);
    const recognizerRef = useRef<CharRecognizer | null>(null);
    const finalizeRef = useRef<() => void>(() => {});

    const elements = history.present;

    // The canvas fills the visible area but never shrinks below its content, so drawings made
    // in full screen stay reachable (by scrolling) after going back to the smaller card view.
    const extent = useMemo(() => contentExtent(elements), [elements]);
    const canvasWidth = Math.max(view.width, Math.ceil(extent.maxX + CONTENT_MARGIN));
    const canvasHeight = Math.max(view.height, Math.ceil(extent.maxY + CONTENT_MARGIN));

    const getRecognizer = () => (recognizerRef.current ??= createCharRecognizer(learned));

    const commit = useCallback((next: SketchElement[]) => {
        setHistory((h) => ({ past: [...h.past, h.present], present: next, future: [] }));
    }, []);

    const resetTransient = () => {
        setStatus(null);
        setOtherChar("");
        lastLineRef.current = null;
        lastGlyphRef.current = null;
    };

    const undo = () => {
        finalizeRef.current();
        setHistory((h) =>
            h.past.length === 0
                ? h
                : { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] },
        );
        resetTransient();
    };

    const redo = () => {
        finalizeRef.current();
        setHistory((h) =>
            h.future.length === 0
                ? h
                : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) },
        );
        resetTransient();
    };

    const drawPending = () => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext("2d")!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const group = pendingRef.current;
        if (group) for (const s of group.strokes) drawSmoothStroke(ctx, s, group.color, group.width);
    };

    // Track the visible drawing area (it changes with the card width and with full screen).
    // Measured synchronously on mount and on full-screen toggles so there's no frame at the old
    // size; the observer picks up later window/card resizes.
    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const measure = () => setView({ width: viewport.clientWidth, height: viewport.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [isFullscreen]);

    // Size both canvases for the device pixel ratio so strokes stay crisp. Resizing wipes the
    // overlay, so the character being written is drawn again.
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        for (const canvas of [baseRef.current, overlayRef.current]) {
            if (!canvas || canvasWidth === 0) continue;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const overlay = overlayRef.current;
        const group = pendingRef.current;
        if (overlay && group) {
            for (const s of group.strokes) drawSmoothStroke(overlay.getContext("2d")!, s, group.color, group.width);
        }
    }, [canvasWidth, canvasHeight]);

    // Redraw every stored element whenever they (or the theme / size) change.
    useEffect(() => {
        const canvas = baseRef.current;
        if (!canvas || canvasWidth === 0) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const rc = rough.canvas(canvas);
        for (const el of elements) {
            if (!pendingErase.has(el.id)) drawElement(rc, ctx, el, theme);
        }
    }, [elements, pendingErase, theme, canvasWidth, canvasHeight]);

    // Leaving browser full screen (Esc, F11, …) returns to the card view.
    useEffect(() => {
        const onChange = () => {
            if (document.fullscreenElement !== containerRef.current) setIsFullscreen(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    // When the Fullscreen API isn't available we fall back to a fixed overlay; Esc closes it too.
    useEffect(() => {
        if (!isFullscreen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsFullscreen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isFullscreen]);

    useEffect(() => () => window.clearTimeout(pauseTimerRef.current), []);

    const enterFullscreen = () => {
        setIsFullscreen(true);
        containerRef.current?.requestFullscreen?.().catch(() => {
            // Not allowed here (e.g. inside an iframe): the CSS overlay still covers the window.
        });
    };

    const exitFullscreen = () => {
        setIsFullscreen(false);
        if (document.fullscreenElement) void document.exitFullscreen();
    };

    const toPoint = (e: ReactPointerEvent | PointerEvent): Point => {
        const rect = overlayRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const eraseAt = (p: Point) => {
        const hit = hitTest(elements.filter((el) => !pendingErase.has(el.id)), p, ERASER_TOLERANCE);
        if (hit) setPendingErase((prev) => new Set(prev).add(hit.id));
    };

    const newStyle = (): ElementStyle => ({ color, strokeWidth, roughness, seed: newSeed() });

    /** Splits everything written since the last pause into characters and adds them as text. */
    const finalizeGroup = () => {
        window.clearTimeout(pauseTimerRef.current);
        const group = pendingRef.current;
        pendingRef.current = null;
        drawPending();
        if (!group) return;

        const style = newStyle();
        const now = performance.now();
        let next = elements;
        let lastGlyph = lastGlyphRef.current;
        // The status bar reports whatever came last: unrecognized ink, or the characters added to one text.
        let unrecognized = null as Extract<Status, { type: "noChar" }> | null;
        let batch = null as { element: TextElement; glyphIndices: number[] } | null;

        for (const segment of segmentCharacters(group.strokes, getRecognizer())) {
            const { result } = segment;
            if (!result) {
                const inks: SketchElement[] = segment.strokes.map((points) => ({ id: newId(), kind: "freehand", points, style }));
                next = [...next, ...inks];
                unrecognized = { type: "noChar", elementIds: inks.map((el) => el.id), strokes: segment.strokes };
                batch = null;
                lastGlyph = null;
                continue;
            }

            const glyph: Glyph = { char: result.char, strokes: segment.strokes, alternatives: result.alternatives, score: result.score };
            const last = next[next.length - 1];
            const relation =
                last?.kind === "text" && lastGlyph?.elementId === last.id && now - lastGlyph.at < WORD_WINDOW_MS
                    ? followsCharacter(lastGlyph.box, segment.box)
                    : null;

            let element: TextElement;
            if (last?.kind === "text" && relation) {
                const space: Glyph[] = relation === "after-space" ? [{ char: " ", strokes: [], alternatives: [], score: 1 }] : [];
                element = { ...last, glyphs: [...last.glyphs, ...space, glyph] };
                next = [...next.slice(0, -1), element];
            } else {
                const fontSize = Math.max(14, Math.round(segment.box.height / CAP_HEIGHT));
                element = { id: newId(), kind: "text", x: segment.box.minX, y: segment.box.maxY, fontSize, glyphs: [glyph], style };
                next = [...next, element];
            }

            const index = element.glyphs.length - 1;
            batch = { element, glyphIndices: batch?.element.id === element.id ? [...batch.glyphIndices, index] : [index] };
            unrecognized = null;
            lastGlyph = { elementId: element.id, box: segment.box, at: now };
        }

        let nextStatus: Status | null = unrecognized;
        if (batch) {
            // Point the correction UI at the least certain character of the batch.
            const { element, glyphIndices } = batch;
            const selected = glyphIndices.reduce((a, b) => (element.glyphs[b].score < element.glyphs[a].score ? b : a));
            nextStatus = { type: "char", elementId: element.id, glyphIndices, selected, corrected: null };
        }

        commit(next);
        lastGlyphRef.current = lastGlyph;
        setStatus(nextStatus);
        setOtherChar("");
    };
    finalizeRef.current = finalizeGroup;

    /** Collects a finished stroke; recognition waits for a short pause in writing. */
    const addToGroup = (stroke: Point[]) => {
        const group = pendingRef.current;
        if (group) {
            group.strokes.push(stroke);
            group.box = strokesBounds(group.strokes);
        } else {
            pendingRef.current = { strokes: [stroke], box: bounds(stroke), color: resolveColor(color, theme), width: strokeWidth };
        }
        drawPending();
        pauseTimerRef.current = window.setTimeout(() => finalizeRef.current(), CHAR_PAUSE_MS);
    };

    const learn = (sample: LearnedChar) => {
        getRecognizer().learn(sample);
        setLearned((prev) => saveLearned([...prev, sample]));
    };

    const forgetLearned = () => {
        setLearned(saveLearned([]));
        recognizerRef.current = createCharRecognizer([]);
    };

    /** Fixes the selected character and remembers the correction. */
    const correctChar = (char: string) => {
        if (status?.type !== "char") return;
        const target = elements.find((el) => el.id === status.elementId);
        if (target?.kind !== "text") return;
        const glyph = target.glyphs[status.selected];
        if (!glyph || glyph.char === char) return;

        const fixed: Glyph = {
            ...glyph,
            char,
            score: 1,
            alternatives: [glyph.char, ...glyph.alternatives.filter((a) => a !== char)],
        };
        const glyphs = target.glyphs.map((g, i) => (i === status.selected ? fixed : g));
        commit(elements.map((el) => (el.id === target.id ? { ...target, glyphs } : el)));
        learn({ char, strokes: compactStrokes(glyph.strokes) });
        setStatus({ ...status, corrected: status.selected });
        setOtherChar("");
    };

    /** Turns ink that wasn't recognized into the character the user says it is, and learns it. */
    const teachUnrecognized = (char: string) => {
        if (status?.type !== "noChar") return;
        const ids = new Set(status.elementIds);
        const ink = elements.filter((el) => ids.has(el.id));
        if (ink.length === 0) return;

        const box = strokesBounds(status.strokes);
        const element: SketchElement = {
            id: newId(),
            kind: "text",
            x: box.minX,
            y: box.maxY,
            fontSize: Math.max(14, Math.round(box.height / CAP_HEIGHT)),
            glyphs: [{ char, strokes: status.strokes, alternatives: [], score: 1 }],
            style: { ...ink[0].style, seed: newSeed() },
        };
        commit([...elements.filter((el) => !ids.has(el.id)), element]);
        learn({ char, strokes: compactStrokes(status.strokes) });
        setStatus({ type: "char", elementId: element.id, glyphIndices: [0], selected: 0, corrected: 0 });
        setOtherChar("");
        lastGlyphRef.current = { elementId: element.id, box, at: performance.now() };
    };

    const submitOther = (value: string) => {
        const char = value.trim().toUpperCase();
        setOtherChar(char.slice(-1));
        if (char.length === 0) return;
        if (status?.type === "char") correctChar(char.slice(-1));
        else if (status?.type === "noChar") teachUnrecognized(char.slice(-1));
    };

    const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        containerRef.current?.focus();
        const p = toPoint(e);

        if (tool === "eraser") {
            erasingRef.current = true;
            eraseAt(p);
            return;
        }

        // Still writing the same character: don't let the pause timer close it mid-stroke.
        window.clearTimeout(pauseTimerRef.current);
        strokeRef.current = [p];
        drawSmoothStroke(overlayRef.current!.getContext("2d")!, [p], resolveColor(color, theme), strokeWidth);
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (erasingRef.current) {
            eraseAt(toPoint(e));
            return;
        }
        const stroke = strokeRef.current;
        if (!stroke) return;

        // Pens report more points than we get events for; use them all for a smoother stroke.
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const ctx = overlayRef.current!.getContext("2d")!;
        const inkColor = resolveColor(color, theme);
        for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
            const p = toPoint(ev);
            const prev = stroke[stroke.length - 1];
            if (prev.x === p.x && prev.y === p.y) continue;
            stroke.push(p);
            drawSmoothStroke(ctx, [prev, p], inkColor, strokeWidth);
        }
    };

    const handlePointerUp = () => {
        if (erasingRef.current) {
            erasingRef.current = false;
            if (pendingErase.size > 0) {
                commit(elements.filter((el) => !pendingErase.has(el.id)));
                setPendingErase(new Set());
                resetTransient();
            }
            return;
        }

        const stroke = strokeRef.current;
        strokeRef.current = null;
        if (!stroke) return;

        if (tool === "text") {
            addToGroup(stroke);
            return;
        }

        drawPending();
        const style = newStyle();
        const freehand: SketchElement = { id: newId(), kind: "freehand", points: stroke, style };

        if (tool === "freehand") {
            commit([...elements, freehand]);
            setStatus(null);
            return;
        }

        // A short stroke right after drawing a line may be that line's arrowhead.
        const last = elements[elements.length - 1];
        const recentLine = lastLineRef.current;
        lastLineRef.current = null;
        if (
            last?.kind === "line" &&
            recentLine?.id === last.id &&
            performance.now() - recentLine.at < ARROW_HEAD_WINDOW_MS
        ) {
            const arrow = tryAttachArrowHead(last, stroke);
            if (arrow) {
                const merged: SketchElement = { ...last, kind: "arrow", ...arrow, raw: [...(last.raw ?? []), stroke] };
                commit([...elements.slice(0, -1), merged]);
                setStatus({ type: "shape", name: "arrow", score: 0.9, elementId: merged.id });
                return;
            }
        }

        const result = recognizeShape(stroke);
        if (!result) {
            commit([...elements, freehand]);
            setStatus(stroke.length > 1 ? { type: "noShape" } : null);
            return;
        }

        const element: SketchElement = { id: newId(), style, raw: [stroke], ...result.shape };
        commit([...elements, element]);
        setStatus({ type: "shape", name: result.name, score: result.score, elementId: element.id });
        if (element.kind === "line") lastLineRef.current = { id: element.id, at: performance.now() };
    };

    /** Replaces what was just recognized (a shape, or the characters of the last pause) with the strokes as drawn. */
    const keepAsDrawn = () => {
        if (status?.type !== "shape" && status?.type !== "char") return;
        const target = elements.find((el) => el.id === status.elementId);
        if (!target) return;

        let strokes: Point[][];
        let replacement: SketchElement[] = [];
        if (status.type === "char" && target.kind === "text") {
            const reverted = new Set(status.glyphIndices);
            strokes = target.glyphs.filter((_, i) => reverted.has(i)).flatMap((g) => g.strokes);
            const glyphs = target.glyphs.filter((_, i) => !reverted.has(i));
            while (glyphs.length > 0 && glyphs[glyphs.length - 1].char === " ") glyphs.pop();
            if (glyphs.length > 0) replacement = [{ ...target, glyphs }];
        } else {
            strokes = target.raw ?? [];
        }
        if (strokes.length === 0) return;

        const inks: SketchElement[] = strokes.map((points) => ({ id: newId(), kind: "freehand", points, style: target.style }));
        commit(elements.flatMap((el) => (el.id === target.id ? [...replacement, ...inks] : [el])));
        resetTransient();
    };

    const clear = () => {
        window.clearTimeout(pauseTimerRef.current);
        pendingRef.current = null;
        drawPending();
        if (elements.length > 0) commit([]);
        resetTransient();
    };

    const selectTool = (value: Tool) => {
        finalizeGroup();
        setTool(value);
    };

    const exportPng = () => {
        finalizeGroup();
        const base = baseRef.current;
        if (!base) return;
        // Wait a frame so a character that was just finalized is drawn before we copy the canvas.
        requestAnimationFrame(() => {
            const out = document.createElement("canvas");
            out.width = base.width;
            out.height = base.height;
            const ctx = out.getContext("2d")!;
            ctx.fillStyle = BACKGROUND[theme];
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.drawImage(base, 0, 0);
            const link = document.createElement("a");
            link.href = out.toDataURL("image/png");
            link.download = "sketch.png";
            link.click();
        });
    };

    const handleKeyDown = (e: ReactKeyboardEvent) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (key === "y" || (key === "z" && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    };

    const toolButton = (value: Tool, label: string) => (
        <button
            key={value}
            onClick={() => selectTool(value)}
            aria-pressed={tool === value}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tool === value ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-gray-200"
            }`}
        >
            {label}
        </button>
    );

    const actionClass =
        "px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed";
    const chipClass =
        "min-w-7 px-2 py-0.5 rounded-md font-mono font-semibold text-gray-800 bg-white border border-gray-300 hover:bg-indigo-50 hover:border-indigo-400";
    const linkClass = "text-indigo-600 hover:underline";

    const otherInput = (
        <label className="flex items-center gap-1.5">
            {t("canvasOther")}
            <input
                value={otherChar}
                onChange={(e) => submitOther(e.target.value)}
                maxLength={2}
                aria-label={t("canvasOther")}
                className="w-9 px-1 py-0.5 text-center font-mono font-semibold uppercase rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
        </label>
    );

    const renderStatus = () => {
        switch (status?.type) {
            case "shape":
                return (
                    <>
                        <span>
                            {t("canvasDetected", {
                                shape: t(`shape_${status.name}`),
                                score: String(Math.round(status.score * 100)),
                            })}
                        </span>
                        <button onClick={keepAsDrawn} className={linkClass}>
                            {t("canvasKeepDrawn")}
                        </button>
                    </>
                );
            case "noShape":
                return <span>{t("canvasNoMatch")}</span>;
            case "char": {
                const target = elements.find((el) => el.id === status.elementId);
                const glyph = target?.kind === "text" ? target.glyphs[status.selected] : undefined;
                if (target?.kind !== "text" || !glyph) return null;
                return (
                    <>
                        {status.glyphIndices.length > 1 && (
                            <span className="flex items-center gap-1">
                                {t("canvasPickChar")}
                                {status.glyphIndices.map((i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setStatus({ ...status, selected: i });
                                            setOtherChar("");
                                        }}
                                        aria-pressed={i === status.selected}
                                        className={`${chipClass} ${i === status.selected ? "ring-2 ring-indigo-500 border-indigo-500" : ""}`}
                                    >
                                        {target.glyphs[i].char}
                                    </button>
                                ))}
                            </span>
                        )}
                        <span>
                            {status.corrected === status.selected
                                ? t("canvasCorrected", { char: glyph.char })
                                : t("canvasRecognized", { char: glyph.char, score: String(Math.round(glyph.score * 100)) })}
                        </span>
                        {glyph.alternatives.length > 0 && (
                            <span className="flex items-center gap-1.5">
                                {t("canvasDidYouMean")}
                                {glyph.alternatives.map((alt) => (
                                    <button key={alt} onClick={() => correctChar(alt)} className={chipClass}>
                                        {alt}
                                    </button>
                                ))}
                            </span>
                        )}
                        {otherInput}
                        <button onClick={keepAsDrawn} className={linkClass}>
                            {t("canvasKeepDrawn")}
                        </button>
                    </>
                );
            }
            case "noChar":
                return (
                    <>
                        <span>{t("canvasNoChar")}</span>
                        {otherInput}
                    </>
                );
            default:
                return (
                    <>
                        <span className="text-gray-400">{tool === "text" ? t("canvasTextHint") : t("canvasHint")}</span>
                        {tool === "text" && learned.length > 0 && (
                            <button onClick={forgetLearned} className={linkClass}>
                                {t("canvasForget", { count: String(learned.length) })}
                            </button>
                        )}
                    </>
                );
        }
    };

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={`outline-none ${isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-gray-100 p-4" : ""}`}
        >
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200">
                    {toolButton("shapes", t("canvasShapes"))}
                    {toolButton("text", t("canvasText"))}
                    {toolButton("freehand", t("canvasFreehand"))}
                    {toolButton("eraser", t("canvasEraser"))}
                </div>

                <div className={`flex gap-1.5 p-1 rounded-full ${theme === "chalkboard" ? "bg-neutral-800" : ""}`}>
                    {COLOR_KEYS.map((key) => (
                        <button
                            key={key}
                            onClick={() => setColor(key)}
                            aria-label={key}
                            className={`w-6 h-6 rounded-full border-2 ${
                                color === key
                                    ? `${theme === "chalkboard" ? "border-white" : "border-gray-900"} scale-110`
                                    : "border-transparent"
                            }`}
                            style={{ backgroundColor: resolveColor(key, theme) }}
                        />
                    ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    {t("canvasStroke")}
                    <input
                        type="range"
                        min={1}
                        max={8}
                        step={0.5}
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-20 accent-indigo-600"
                    />
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    {t("canvasRoughness")}
                    <input
                        type="range"
                        min={0}
                        max={3}
                        step={0.25}
                        value={roughness}
                        onChange={(e) => setRoughness(Number(e.target.value))}
                        className="w-20 accent-indigo-600"
                    />
                </label>

                <div className="flex flex-wrap gap-2 ml-auto">
                    <button
                        onClick={() => setTheme(theme === "light" ? "chalkboard" : "light")}
                        aria-pressed={theme === "chalkboard"}
                        className={
                            theme === "chalkboard"
                                ? "px-3 py-1.5 rounded-md text-sm font-medium text-white bg-neutral-900 border border-neutral-900 hover:bg-neutral-800"
                                : actionClass
                        }
                    >
                        {t("canvasChalkboard")}
                    </button>
                    <button onClick={undo} disabled={history.past.length === 0} className={actionClass}>
                        {t("canvasUndo")}
                    </button>
                    <button onClick={redo} disabled={history.future.length === 0} className={actionClass}>
                        {t("canvasRedo")}
                    </button>
                    <button onClick={clear} disabled={elements.length === 0} className={actionClass}>
                        {t("clear")}
                    </button>
                    <button onClick={exportPng} disabled={elements.length === 0} className={actionClass}>
                        {t("canvasExportPng")}
                    </button>
                    <button onClick={isFullscreen ? exitFullscreen : enterFullscreen} className={actionClass}>
                        {isFullscreen ? t("canvasExitFullscreen") : t("canvasFullscreen")}
                    </button>
                </div>
            </div>

            <div
                ref={viewportRef}
                className={`relative rounded-lg border overflow-auto ${
                    theme === "chalkboard" ? "border-neutral-700" : "border-gray-300"
                } ${isFullscreen ? "flex-1 min-h-0" : ""}`}
                style={{ height: isFullscreen ? undefined : VIEW_HEIGHT, backgroundColor: BACKGROUND[theme] }}
            >
                <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
                    <canvas ref={baseRef} className="absolute inset-0" style={{ width: canvasWidth, height: canvasHeight }} />
                    <canvas
                        ref={overlayRef}
                        className={`absolute inset-0 touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
                        style={{ width: canvasWidth, height: canvasHeight }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 min-h-8 text-sm text-gray-600" data-testid="canvas-status">
                {renderStatus()}
            </div>
        </div>
    );
}
