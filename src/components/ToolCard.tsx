import { useState, useRef, useEffect } from "react";
import type { ActiveTool } from "../interfaces/tool";

interface ToolCardProps {
    tool: ActiveTool;
    onRemove: (instanceId: number) => void;
}

export default function ToolCard({ tool, onRemove }: ToolCardProps) {
    const [isConfirming, setIsConfirming] = useState(false);
    const confirmRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
                setIsConfirming(false);
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsConfirming(false);
            }
        }

        if (isConfirming) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isConfirming]);

    return (
        <div className={`relative ${tool.color} p-6 rounded-lg shadow-lg mb-4`}>
            {isConfirming && (
                <div
                    ref={confirmRef}
                    className="absolute bottom-full right-2 mb-2 p-2 rounded-md bg-gray-800 text-white"
                >
                    <button
                        onClick={() => onRemove(tool.instanceId)}
                        className="px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600"
                    >
                        Confirm
                    </button>
                </div>
            )}
            <button
                onClick={() => setIsConfirming(true)}
                className="absolute top-2 right-2 p-1 rounded-md bg-red-500 text-white hover:bg-red-600"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="h-6 w-6"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {tool.name}
            </h2>
            {tool.component}
        </div>
    );
}
