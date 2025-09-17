import { createElement, useState } from "react";
import ToolCard from "../components/ToolCard";
import ToolSelector from "../components/ToolSelector";
import StringTool from "../components/StringTool";
import JsonTool from "../components/JsonTool";
import EpochTool from "../components/EpochTool";
import type { ToolConfig, ActiveTool } from "../interfaces/tool";
const tools: ToolConfig[] = [
    { id: 1, name: "String Tool", component: StringTool },
    { id: 2, name: "JSON Tool", component: JsonTool },
    { id: 3, name: "Epoch Tool", component: EpochTool },
    // { id: 3, name: "Tool 3", component: <div>Tool 3 Content</div> },
    // { id: 4, name: "Tool 4", component: <div>Tool 4 Content</div> },
];

export default function HomePage() {
    const [selectedTools, setSelectedTools] = useState<ActiveTool[]>([]);

    const addTool = (tool: ToolConfig) => {
        const color = randomColor();
        const instanceId = Date.now();
        const component = createElement(tool.component);

        const activeTool: ActiveTool = {
            id: tool.id,
            name: tool.name,
            component,
            instanceId,
            color,
        };

        setSelectedTools((prev) => [...prev, activeTool]);
    };

    const removeTool = (instanceId: number) => {
        if (window.confirm("Are you sure you want to close this tool?")) {
            setSelectedTools((prev) => prev.filter((t) => t.instanceId !== instanceId));
        }
    };

    return (
        <section className="bg-gray-100 min-h-screen">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
                    Multi Tool App
                </h1>

                <ToolSelector tools={tools} onSelect={addTool} />

                <div className="grid-cols-1">
                    {selectedTools.map((tool) => (
                        <ToolCard key={tool.instanceId} tool={tool} onRemove={removeTool} />
                    ))}
                </div>
            </div>
        </section>
    );
}

const colors = [
    'bg-slate-50',
    'bg-gray-50',
    'bg-zinc-50',
    'bg-neutral-50',
    'bg-stone-50',
    'bg-red-50',
    'bg-orange-50',
    'bg-amber-50',
    'bg-yellow-50',
    'bg-lime-50',
    'bg-green-50',
    'bg-emerald-50',
    'bg-teal-50',
    'bg-cyan-50',
    'bg-sky-50',
    'bg-blue-50',
    'bg-indigo-50',
    'bg-violet-50',
    'bg-purple-50',
    'bg-fuchsia-50',
    'bg-pink-50',
    'bg-rose-50',
  ];

const randomColor = () => colors[Math.floor(Math.random() * colors.length)];
