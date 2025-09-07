import type React from "react";

interface ToolCardProps {
    tool: {
        id: number;
        name: string;
        component: React.ReactElement;
        instanceId: number;
        color: string;
    };
    onRemove: (instanceId: number) => void;
}

export default function ToolCard({ tool, onRemove }: ToolCardProps) {
    console.log(tool.color);
    
    return (
        <div className={`relative ${tool.color} p-6 rounded-lg shadow-lg mb-4`}>

            <button
                onClick={() => onRemove(tool.instanceId)}
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
