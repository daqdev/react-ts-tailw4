import type { ToolConfig } from "../interfaces/tool";

interface ToolSelectorProps {
    tools: ToolConfig[];
    onSelect: (tool: ToolConfig) => void;
}

export default function ToolSelector({ tools, onSelect }: ToolSelectorProps) {
    return (
        <div className="flex justify-center gap-4 mb-8">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => onSelect(tool)}
                    className="px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors"
                >
                    {tool.name}
                </button>
            ))}
        </div>
    );
}
