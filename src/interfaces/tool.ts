import type { ComponentType, ReactElement } from "react";

export interface ToolConfig {
    id: number;
    name: string;
    component: ComponentType;
    color?: string;
}

export interface ActiveTool {
    id: number;
    name: string;
    component: ReactElement;
    instanceId: number;
    color?: string;
}
