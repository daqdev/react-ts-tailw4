import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import rough from "roughjs";
import { useTranslation } from "../hooks/useTranslation";
import type { Point } from "../lib/sketch/geometry";
import { recognizeShape, tryAttachArrowHead, type ShapeName } from "../lib/sketch/shapes";
import { hitTest, type ElementStyle, type SketchElement } from "../lib/sketch/elements";
import { drawElement, drawSmoothStroke } from "../lib/sketch/render";

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

const CANVAS_HEIGHT = 480;
/** A separate stroke counts as the head of the previous line only if drawn within this window. */
const ARROW_HEAD_WINDOW_MS = 4000;
const ERASER_TOLERANCE = 8;
const COLORS = ["#1e293b", "#4f46e5", "#059669", "#e11d48", "#d97706", "#0891b2"];

let nextId = 1;
const newId = () => nextId++;
const newSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;

export default function SmartCanvasTool() {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const baseRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    const [width, setWidth] = useState(0);
    const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
    const [tool, setTool] = useState<Tool>("smart");
    const [color, setColor] = useState(COLORS[0]);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [roughness, setRoughness] = useState(1);
    const [status, setStatus] = useState<Status | null>(null);
    const [pendingErase, setPendingErase] = useState<Set<number>>(new Set());

    const strokeRef = useRef<Point[] | null>(null);
    const erasingRef = useRef(false);
    const lastLineRef = useRef<{ id: number; at: number } | null>(null);

    const elements = history.present;

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

    // Track the container width so the canvas fills the card.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Size both canvases for the device pixel ratio so strokes stay crisp.
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        for (const canvas of [baseRef.current, overlayRef.current]) {
            if (!canvas || width === 0) continue;
            canvas.width = width * dpr;
            canvas.height = CANVAS_HEIGHT * dpr;
            canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }, [width]);

    // Redraw every stored element whenever they change.
    useEffect(() => {
        const canvas = baseRef.current;
        if (!canvas || width === 0) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, width, CANVAS_HEIGHT);
        const rc = rough.canvas(canvas);
        for (const el of elements) {
            if (!pendingErase.has(el.id)) drawElement(rc, ctx, el);
        }
    }, [elements, pendingErase, width]);

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
        drawSmoothStroke(overlayRef.current!.getContext("2d")!, [p], color, strokeWidth);
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
        for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
            const p = toPoint(ev);
            const prev = stroke[stroke.length - 1];
            if (prev.x === p.x && prev.y === p.y) continue;
            stroke.push(p);
            drawSmoothStroke(ctx, [prev, p], color, strokeWidth);
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
        overlayRef.current!.getContext("2d")!.clearRect(0, 0, width, CANVAS_HEIGHT);
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
        ctx.fillStyle = "#ffffff";
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
        <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none">
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200">
                    {toolButton("smart", t("canvasSmart"))}
                    {toolButton("freehand", t("canvasFreehand"))}
                    {toolButton("eraser", t("canvasEraser"))}
                </div>

                <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            aria-label={c}
                            className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-gray-900 scale-110" : "border-white"}`}
                            style={{ backgroundColor: c }}
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

                <div className="flex gap-2 ml-auto">
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
                </div>
            </div>

            <div className="relative rounded-lg border border-gray-300 bg-white overflow-hidden" style={{ height: CANVAS_HEIGHT }}>
                <canvas ref={baseRef} className="absolute inset-0" style={{ width, height: CANVAS_HEIGHT }} />
                <canvas
                    ref={overlayRef}
                    className={`absolute inset-0 touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
                    style={{ width, height: CANVAS_HEIGHT }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />
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
