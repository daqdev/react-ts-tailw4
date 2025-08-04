import { useState } from "react";
import ToolCard from "../components/ToolCard";
import ToolSelector from "../components/ToolSelector";
import StringTool from "../components/StringTool";

interface Tool {
    id: number;
    name: string;
    component: React.ReactElement;
}

interface SelectedTool extends Tool {
    instanceId: number;
}

const tools: Tool[] = [
    { id: 1, name: "String Tool", component: <StringTool /> },
    // { id: 2, name: "Tool 2", component: <div>Tool 2 Content</div> },
    // { id: 3, name: "Tool 3", component: <div>Tool 3 Content</div> },
    // { id: 4, name: "Tool 4", component: <div>Tool 4 Content</div> },
];

export default function HomePage() {
    const [selectedTools, setSelectedTools] = useState<SelectedTool[]>([]);

    const addTool = (tool: Tool) => {
        if (selectedTools.length < 3) {
            setSelectedTools((prev) => [...prev, { ...tool, instanceId: Date.now() }]);
        }
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

                <div
                    className={`grid gap-8 ${
                        selectedTools.length === 1
                            ? "grid-cols-1"
                            : selectedTools.length === 2
                            ? "grid-cols-1 md:grid-cols-2"
                            : "grid-cols-1 md:grid-cols-3"
                    }`}
                >
                    {selectedTools.map((tool: SelectedTool) => (
                        <ToolCard key={tool.instanceId} tool={tool} onRemove={removeTool} />
                    ))}
                </div>
            </div>
        </section>
    );
}