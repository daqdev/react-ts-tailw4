import { useCallback, useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 320;

export default function EpochTool() {
    const [isOpen, setIsOpen] = useState(false);
    const [isTransparent, setIsTransparent] = useState(false);
    const [position, setPosition] = useState({ x: 120, y: 120 });
    const [isDragging, setIsDragging] = useState(false);
    const [epochInput, setEpochInput] = useState("");
    const [convertedDate, setConvertedDate] = useState("");
    const [liveEpoch, setLiveEpoch] = useState(() => Math.floor(Date.now() / 1000).toString());

    useEffect(() => {
        if (!isOpen || typeof window === "undefined") {
            return;
        }

        const initialX = Math.max(
            24,
            (window.innerWidth - POPUP_WIDTH) / 2
        );
        const initialY = Math.max(
            24,
            (window.innerHeight - POPUP_HEIGHT) / 2
        );
        setPosition({ x: initialX, y: initialY });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const tick = () => {
            setLiveEpoch(Math.floor(Date.now() / 1000).toString());
        };

        tick();
        const interval = window.setInterval(tick, 1000);

        return () => window.clearInterval(interval);
    }, [isOpen]);

    useEffect(() => {
        if (!epochInput.trim()) {
            setConvertedDate("");
            return;
        }

        const numericValue = Number(epochInput.trim());
        if (Number.isNaN(numericValue)) {
            setConvertedDate("Invalid epoch value");
            return;
        }

        const epochMs = epochInput.trim().length > 10 ? numericValue : numericValue * 1000;
        const parsedDate = new Date(epochMs);

        if (Number.isNaN(parsedDate.getTime())) {
            setConvertedDate("Invalid epoch value");
            return;
        }

        setConvertedDate(parsedDate.toLocaleString());
    }, [epochInput]);

    const startDrag = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startY = event.clientY;
        const initialX = position.x;
        const initialY = position.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const viewportWidth = typeof window !== "undefined" ? window.innerWidth : POPUP_WIDTH;
            const viewportHeight = typeof window !== "undefined" ? window.innerHeight : POPUP_HEIGHT;

            const nextX = initialX + deltaX;
            const nextY = initialY + deltaY;

            const clampedX = Math.min(
                Math.max(nextX, 16),
                Math.max(viewportWidth - POPUP_WIDTH - 16, 16)
            );

            const clampedY = Math.min(
                Math.max(nextY, 16),
                Math.max(viewportHeight - POPUP_HEIGHT - 16, 16)
            );

            setPosition({
                x: clampedX,
                y: clampedY,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        setIsDragging(true);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp, { once: true });
    }, [position.x, position.y]);

    const handleOpen = () => {
        setIsTransparent(false);
        setEpochInput("");
        setConvertedDate("");
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        setIsTransparent(false);
        setIsDragging(false);
    };

    const handleBackgroundClick = () => {
        setIsTransparent(true);
    };

    const handlePopupClick = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="text-gray-700">
                Convert between epoch timestamps and human-readable dates on the fly.
            </p>
            <div className="flex gap-3">
                <button
                    onClick={handleOpen}
                    className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                    Open Epoch Popup
                </button>
                {isOpen && (
                    <button
                        onClick={handleClose}
                        className="rounded-md bg-slate-200 px-4 py-2 font-semibold text-slate-700 shadow hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                        Close Popup
                    </button>
                )}
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/30"
                    onClick={handleBackgroundClick}
                >
                    <div
                        onClick={handlePopupClick}
                        className={`absolute max-w-[90vw] rounded-xl bg-white shadow-2xl ring-1 ring-black/10 transition-opacity ${isTransparent ? "opacity-10" : "opacity-100"}`}
                        style={{
                            top: position.y,
                            left: position.x,
                            cursor: isDragging ? "grabbing" : "grab",
                            width: POPUP_WIDTH,
                            minWidth: 280,
                        }}
                    >
                        <div
                            className="flex items-center justify-between border-b border-slate-200 px-4 py-2 cursor-grab"
                            onMouseDown={startDrag}
                        >
                            <span className="font-semibold text-slate-700">
                                Epoch Converter
                            </span>
                            <button
                                onClick={handleClose}
                                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Close popup"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="h-5 w-5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 px-4 py-4">
                            <div>
                                <p className="text-sm font-medium text-slate-600">
                                    Current epoch (seconds)
                                </p>
                                <p className="text-lg font-semibold text-slate-900" data-testid="current-epoch">
                                    {liveEpoch}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600" htmlFor="epoch-input">
                                    Epoch input (seconds or milliseconds)
                                </label>
                                <input
                                    id="epoch-input"
                                    value={epochInput}
                                    onChange={(event) => setEpochInput(event.target.value)}
                                    placeholder="1697040000"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                {convertedDate && (
                                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                        {convertedDate}
                                    </p>
                                )}
                            </div>
                            {isTransparent && (
                                <button
                                    onClick={() => setIsTransparent(false)}
                                    className="self-start rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    Restore visibility
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
