/** A deployment-window plan. `id`s are in-memory only: they're not part of the JSON file. */
export interface Step {
    id: string;
    description: string;
    /** Whole minutes, >= 0. */
    duration: number;
    owner: string;
}

export interface Section {
    id: string;
    name: string;
    steps: Step[];
}

export interface Plan {
    title: string;
    /** Always a valid "HH:MM" (24 h). */
    startTime: string;
    /** Choices offered for each step's owner. */
    owners: string[];
    sections: Section[];
}

let lastId = 0;
/** Stable keys for React lists; unique within the page. */
export const newId = (prefix: string) => `${prefix}${++lastId}`;
