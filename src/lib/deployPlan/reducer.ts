import { newId, type Plan, type Section, type Step } from "./types";

export type PlanAction =
    | { type: "replace"; plan: Plan }
    | { type: "setTitle"; title: string }
    /** Must be an already-normalized "HH:MM". */
    | { type: "setStartTime"; startTime: string }
    | { type: "setOwners"; owners: string[] }
    | { type: "addStep"; sectionId: string }
    | { type: "updateStep"; sectionId: string; stepId: string; patch: Partial<Omit<Step, "id">> }
    | { type: "removeStep"; sectionId: string; stepId: string }
    /** Moves a step up (-1) or down (+1) within its section. */
    | { type: "moveStep"; sectionId: string; stepId: string; offset: -1 | 1 };

function mapSection(plan: Plan, sectionId: string, fn: (steps: Step[]) => Step[]): Plan {
    return {
        ...plan,
        sections: plan.sections.map((s): Section => (s.id === sectionId ? { ...s, steps: fn(s.steps) } : s)),
    };
}

export function planReducer(plan: Plan, action: PlanAction): Plan {
    switch (action.type) {
        case "replace":
            return action.plan;
        case "setTitle":
            return { ...plan, title: action.title };
        case "setStartTime":
            return { ...plan, startTime: action.startTime };
        case "setOwners":
            return { ...plan, owners: action.owners };
        case "addStep":
            return mapSection(plan, action.sectionId, (steps) => [
                ...steps,
                { id: newId("step"), description: "", duration: 5, owner: "" },
            ]);
        case "updateStep":
            return mapSection(plan, action.sectionId, (steps) =>
                steps.map((s) => (s.id === action.stepId ? { ...s, ...action.patch } : s)),
            );
        case "removeStep":
            return mapSection(plan, action.sectionId, (steps) => steps.filter((s) => s.id !== action.stepId));
        case "moveStep":
            return mapSection(plan, action.sectionId, (steps) => {
                const from = steps.findIndex((s) => s.id === action.stepId);
                const to = from + action.offset;
                if (from < 0 || to < 0 || to >= steps.length) return steps;
                const next = [...steps];
                [next[from], next[to]] = [next[to], next[from]];
                return next;
            });
    }
}
