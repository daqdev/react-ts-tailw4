const MINUTES_PER_DAY = 24 * 60;

/** Minutes since midnight for "H:MM" / "HH:MM" (24 h), or null when the text isn't a valid time. */
export function parseTime(text: string): number | null {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** "HH:MM" for a minute count; wraps past midnight in both directions. */
export function formatTime(minutes: number): string {
    const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Normalized "HH:MM" (e.g. "9:05" → "09:05"), or null when invalid. */
export function normalizeTime(text: string): string | null {
    const minutes = parseTime(text);
    return minutes === null ? null : formatTime(minutes);
}
