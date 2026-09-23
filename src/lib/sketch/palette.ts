export type CanvasTheme = "light" | "chalkboard";

/**
 * Elements store a palette key instead of a raw color so switching the canvas theme
 * recolors existing drawings too (dark ink on paper ↔ light chalk on the board).
 */
export const PALETTE = {
    ink: { light: "#1e293b", chalkboard: "#f1f5f9" },
    indigo: { light: "#4f46e5", chalkboard: "#a5b4fc" },
    green: { light: "#059669", chalkboard: "#86efac" },
    red: { light: "#e11d48", chalkboard: "#fda4af" },
    amber: { light: "#d97706", chalkboard: "#fde68a" },
    cyan: { light: "#0891b2", chalkboard: "#67e8f9" },
} as const;

export type ColorKey = keyof typeof PALETTE;

export const COLOR_KEYS = Object.keys(PALETTE) as ColorKey[];

export const BACKGROUND: Record<CanvasTheme, string> = {
    light: "#ffffff",
    chalkboard: "#141414",
};

export const resolveColor = (key: ColorKey, theme: CanvasTheme) => PALETTE[key][theme];
