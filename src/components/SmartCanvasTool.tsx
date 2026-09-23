import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import rough from "roughjs";
import { useTranslation } from "../hooks/useTranslation";
import type { Point } from "../lib/sketch/geometry";
import { recognizeShape, tryAttachArrowHead, type ShapeName } from "../lib/sketch/shapes";
import { contentExtent, hitTest, type ElementStyle, type SketchElement } from "../lib/sketch/elements";
import { drawElement, drawSmoothStroke } from "../lib/sketch/render";
import { BACKGROUND, COLOR_KEYS, resolveColor, type CanvasTheme, type ColorKey } from "../lib/sketch/palette";

type Tool = "smart" | "freehand" | "eraser";

interface History {
    past: SketchElement[][];
    present: SketchElement[];
    future: SketchElement[][];
}

interface Status {
    name: ShapeName | null;
    score: number;
    elementId: number;
}

/** Height of the drawing area in the normal (card) view. */
const VIEW_HEIGHT = 480;
/** Room kept past the furthest element when the canvas grows to fit its content. */
const CONTENT_MARGIN = 24;
/** A separate stroke counts as the head of the previous line only if drawn within this window. */
const ARROW_HEAD_WINDOW_MS = 4000;
const ERASER_TOLERANCE = 8;

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
    const [tool, setTool] = useState<Tool>("smart");
    const [color, setColor] = useState<ColorKey>("ink");
    const [theme, setTheme] = useState<CanvasTheme>("light");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [roughness, setRoughness] = useState(1);
    const [status, setStatus] = useState<Status | null>(null);
    const [pendingErase, setPendingErase] = useState<Set<number>>(new Set());

    const strokeRef = useRef<Point[] | null>(null);
    const erasingRef = useRef(false);
    const lastLineRef = useRef<{ id: number; at: number } | null>(null);

    const elements = history.present;

    // The canvas fills the visible area but never shrinks below its content, so drawings made
    // in full screen stay reachable (by scrolling) after going back to the smaller card view.
    const extent = useMemo(() => contentExtent(elements), [elements]);
    const canvasWidth = Math.max(view.width, Math.ceil(extent.maxX + CONTENT_MARGIN));
    const canvasHeight = Math.max(view.height, Math.ceil(extent.maxY + CONTENT_MARGIN));

    const commit = useCallback((next: SketchElement[]) => {
        setHistory((h) => ({ past: [...h.past, h.present], present: next, future: [] }));
    }, []);

    const undo = useCallback(() => {
        setHistory((h) =>
            h.past.length === 0
                ? h
                : { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] },
        );
        setStatus(null);
        lastLineRef.current = null;
    }, []);

    const redo = useCallback(() => {
        setHistory((h) =>
            h.future.length === 0
                ? h
                : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) },
        );
        setStatus(null);
        lastLineRef.current = null;
    }, []);

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

    // Size both canvases for the device pixel ratio so strokes stay crisp.
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        for (const canvas of [baseRef.current, overlayRef.current]) {
            if (!canvas || canvasWidth === 0) continue;
            canvas.width = canvasWidth * dpr;
            canvas.height = canvasHeight * dpr;
            canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
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
                setStatus(null);
            }
            return;
        }

        const stroke = strokeRef.current;
        strokeRef.current = null;
        overlayRef.current!.getContext("2d")!.clearRect(0, 0, canvasWidth, canvasHeight);
        if (!stroke) return;

        const style: ElementStyle = { color, strokeWidth, roughness, seed: newSeed() };
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
                setStatus({ name: "arrow", score: 0.9, elementId: merged.id });
                return;
            }
        }

        const result = recognizeShape(stroke);
        if (!result) {
            commit([...elements, freehand]);
            setStatus(stroke.length > 1 ? { name: null, score: 0, elementId: freehand.id } : null);
            return;
        }

        const element: SketchElement = { id: newId(), style, raw: [stroke], ...result.shape };
        commit([...elements, element]);
        setStatus({ name: result.name, score: result.score, elementId: element.id });
        if (element.kind === "line") lastLineRef.current = { id: element.id, at: performance.now() };
    };

    /** Replaces the last recognized shape with the strokes the user actually drew. */
    const keepAsDrawn = () => {
        if (!status) return;
        const target = elements.find((el) => el.id === status.elementId);
        if (!target?.raw) return;
        const strokes: SketchElement[] = target.raw.map((points) => ({
            id: newId(),
            kind: "freehand",
            points,
            style: target.style,
        }));
        commit(elements.flatMap((el) => (el.id === target.id ? strokes : [el])));
        setStatus(null);
        lastLineRef.current = null;
    };

    const clear = () => {
        if (elements.length === 0) return;
        commit([]);
        setStatus(null);
        lastLineRef.current = null;
    };

    const exportPng = () => {
        const base = baseRef.current;
        if (!base) return;
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
            onClick={() => setTool(value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tool === value ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-gray-200"
            }`}
        >
            {label}
        </button>
    );

    const actionClass =
        "px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed";

    const knownShape = status?.name ? status : null;

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={`outline-none ${isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-gray-100 p-4" : ""}`}
        >
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200">
                    {toolButton("smart", t("canvasSmart"))}
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

            <div className="flex items-center gap-3 mt-2 min-h-8 text-sm text-gray-600">
                {knownShape ? (
                    <>
                        <span>
                            {t("canvasDetected", {
                                shape: t(`shape_${knownShape.name}`),
                                score: String(Math.round(knownShape.score * 100)),
                            })}
                        </span>
                        <button onClick={keepAsDrawn} className="text-indigo-600 hover:underline">
                            {t("canvasKeepDrawn")}
                        </button>
                    </>
                ) : status ? (
                    <span>{t("canvasNoMatch")}</span>
                ) : (
                    <span className="text-gray-400">{t("canvasHint")}</span>
                )}
            </div>
        </div>
    );
}
