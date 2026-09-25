import { formatTime, parseTime } from "./time";
import type { Plan } from "./types";

export interface ScheduledStep {
    /** 1-based number, continuous across sections (the "ID" column). */
    number: number;
    stepId: string;
    description: string;
    duration: number;
    owner: string;
    start: string;
    end: string;
}

export interface ScheduledSection {
    id: string;
    name: string;
    minutes: number;
    steps: ScheduledStep[];
}

export interface Schedule {
    start: string;
    end: string;
    totalMinutes: number;
    sections: ScheduledSection[];
}

/**
 * Steps run back to back from the plan's start time, across all sections in order.
 * Single source for the table, the plain-text copy and the totals.
 */
export function schedulePlan(plan: Plan): Schedule {
    const start = parseTime(plan.startTime) ?? 0;
    let cursor = start;
    let number = 0;

    const sections = plan.sections.map((section) => {
        let minutes = 0;
        const steps = section.steps.map((step) => {
            const stepStart = cursor;
            cursor += step.duration;
            minutes += step.duration;
            return {
                number: ++number,
                stepId: step.id,
                description: step.description,
                duration: step.duration,
                owner: step.owner,
                start: formatTime(stepStart),
                end: formatTime(cursor),
            };
        });
        return { id: section.id, name: section.name, minutes, steps };
    });

    return {
        start: formatTime(start),
        end: formatTime(cursor),
        totalMinutes: cursor - start,
        sections,
    };
}
