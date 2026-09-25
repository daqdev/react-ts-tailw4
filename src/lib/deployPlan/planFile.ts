import { normalizeTime } from "./time";
import { newId, type Plan, type Section, type Step } from "./types";

/*
 * The plan's JSON file: what the user downloads, loads back, and what is kept
 * in this browser's localStorage. Real system and team names live only there,
 * never in the repo.
 */

export const FILE_VERSION = 1;
export const MAX_DURATION = 9999;
const STORAGE_KEY = "oktools.deployPlan.v1";

export interface PlanFile {
    version: number;
    title: string;
    startTime: string;
    owners: string[];
    sections: { name: string; steps: { description: string; duration: number; owner: string }[] }[];
}

const step = (description: string, duration: number, owner: string): Step => ({
    id: newId("step"),
    description,
    duration,
    owner,
});

/** Neutral example shown until the user loads or edits a plan. */
export function examplePlan(): Plan {
    return {
        title: "Plan de Despliegue",
        startTime: "22:00",
        owners: ["Operaciones", "IT", "Usuario", "DBA", "Redes"],
        sections: [
            {
                id: newId("section"),
                name: "INICIO",
                steps: [
                    step("Detener servidores de aplicación", 5, "Operaciones"),
                    step("Script de base de datos", 10, "DBA"),
                    step("Desplegar nuevas versiones e iniciar servidores", 20, "Operaciones"),
                    step("Desplegar frontend", 15, "IT"),
                    step("Verificación interna de Sistemas", 60, "IT"),
                    step("Pruebas de usuario", 60, "Usuario"),
                ],
            },
            {
                id: newId("section"),
                name: "GO",
                steps: [
                    step("Habilitar acceso a usuarios", 5, "Redes"),
                    step("Monitoreo posterior al despliegue", 30, "IT"),
                ],
            },
            { id: newId("section"), name: "ROLLBACK", steps: [] },
        ],
    };
}

/** Trims, drops empty entries and duplicates. */
export function normalizeOwners(owners: string[]): string[] {
    return [...new Set(owners.map((o) => o.trim()).filter(Boolean))];
}

export const isValidDuration = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_DURATION;

export function toPlanFile(plan: Plan): PlanFile {
    return {
        version: FILE_VERSION,
        title: plan.title,
        startTime: plan.startTime,
        owners: plan.owners,
        sections: plan.sections.map((s) => ({
            name: s.name,
            steps: s.steps.map(({ description, duration, owner }) => ({ description, duration, owner })),
        })),
    };
}

export const serializePlan = (plan: Plan) => JSON.stringify(toPlanFile(plan), null, 2);

type ParseResult = { plan: Plan } | { error: string };

class PlanFileError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

function optionalString(obj: Record<string, unknown>, key: string, path: string, fallback: string): string {
    const value = obj[key];
    if (value === undefined) return fallback;
    if (typeof value !== "string") throw new PlanFileError(`${path}${key} must be text`);
    return value;
}

function parseStep(value: unknown, path: string): Step {
    if (!isObject(value)) throw new PlanFileError(`${path} must be an object`);
    const duration = value.duration;
    if (typeof duration !== "number" || !isValidDuration(duration)) {
        throw new PlanFileError(`${path}.duration must be a whole number of minutes between 0 and ${MAX_DURATION}`);
    }
    return step(
        optionalString(value, "description", `${path}.`, ""),
        duration,
        optionalString(value, "owner", `${path}.`, "").trim(),
    );
}

function parseSection(value: unknown, path: string): Section {
    if (!isObject(value)) throw new PlanFileError(`${path} must be an object`);
    if (typeof value.name !== "string") throw new PlanFileError(`${path}.name must be text`);
    const steps = value.steps ?? [];
    if (!Array.isArray(steps)) throw new PlanFileError(`${path}.steps must be a list`);
    return {
        id: newId("section"),
        name: value.name,
        steps: steps.map((s, i) => parseStep(s, `${path}.steps[${i}]`)),
    };
}

/** Validates a parsed JSON file. Missing optional fields take the example's values. */
export function parsePlanFile(value: unknown): ParseResult {
    try {
        if (!isObject(value)) throw new PlanFileError("the file must contain a JSON object");
        if (value.version !== undefined && value.version !== FILE_VERSION) {
            throw new PlanFileError(`unsupported version ${JSON.stringify(value.version)}`);
        }

        const example = examplePlan();
        const startText = optionalString(value, "startTime", "", example.startTime);
        const startTime = normalizeTime(startText);
        if (startTime === null) throw new PlanFileError(`startTime "${startText}" is not a valid HH:MM time`);

        const owners = value.owners ?? [];
        if (!Array.isArray(owners) || owners.some((o) => typeof o !== "string")) {
            throw new PlanFileError("owners must be a list of text values");
        }

        if (!Array.isArray(value.sections) || value.sections.length === 0) {
            throw new PlanFileError("sections must be a non-empty list");
        }

        return {
            plan: {
                title: optionalString(value, "title", "", example.title),
                startTime,
                owners: normalizeOwners(owners),
                sections: value.sections.map((s, i) => parseSection(s, `sections[${i}]`)),
            },
        };
    } catch (e) {
        if (e instanceof PlanFileError) return { error: e.message };
        throw e;
    }
}

export function parsePlanJson(text: string): ParseResult {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { error: "the file is not valid JSON" };
    }
    return parsePlanFile(value);
}

/** The plan saved in this browser, or null. Storage can be missing or blocked, so every access is guarded. */
export function loadStoredPlan(): Plan | null {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (text === null) return null;
        const result = parsePlanJson(text);
        return "plan" in result ? result.plan : null;
    } catch {
        return null;
    }
}

export function storePlan(plan: Plan): void {
    try {
        localStorage.setItem(STORAGE_KEY, serializePlan(plan));
    } catch {
        // Storage full or blocked: the plan still works for this session.
    }
}
