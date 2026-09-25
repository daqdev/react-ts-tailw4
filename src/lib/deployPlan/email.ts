import type { Schedule } from "./schedule";

/*
 * Email markup tuned for Outlook Web. Colors, sizes and widths replicate the
 * real email the plan is sent in; keep them as they are. The email content is
 * always in Spanish.
 */
const C_HDR = "#0F243E"; // main header
const C_SEC = "#8497B0"; // section separator row
const C_BORDER = "#000000"; // borders ("windowtext" in the original)
const FONT = "Calibri,sans-serif";
const PT = "10pt"; // text size inside the span
const P_WRAP = "font-size:12pt;font-family:'Times New Roman',serif;margin:0;";

/** Column widths in pt (~623pt in total, like the original). */
const W = { id: 24, task: 287, status: 47, start: 63.3, end: 60.7, duration: 62, owner: 79 };
const H_HEADER = "15pt";
const H_SECTION = "15pt";
const H_ROW = "28.2pt";

const STATUS = "Pendiente";

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Top border only on the first row and left border only on the first column,
 * so adjacent cells never draw a double border (same as Excel's export).
 */
function border(firstCol: boolean, firstRow: boolean): string {
    const top = firstRow ? "solid" : "none";
    const left = firstCol ? "solid" : "none";
    return `border-width:1pt;border-style:${top} solid solid ${left};border-color:${C_BORDER};`;
}

interface CellOptions {
    /** Already-escaped HTML. */
    html?: string;
    width: number;
    height: string;
    background?: string;
    bold?: boolean;
    color?: string;
    align?: "center" | "left";
    firstCol?: boolean;
    firstRow?: boolean;
    rowspan?: number;
    colspan?: number;
}

/**
 * The text color goes on the inner <span>, not on the <td>:
 * Outlook Web injects its own <p> and overrides the <td> color.
 */
function cell({
    html = "&nbsp;",
    width,
    height,
    background,
    bold = false,
    color = "black",
    align = "center",
    firstCol = false,
    firstRow = false,
    rowspan,
    colspan,
}: CellOptions): string {
    const attrs = (rowspan ? ` rowspan="${rowspan}"` : "") + (colspan ? ` colspan="${colspan}"` : "");
    const tdStyle =
        (background ? `background-color:${background};` : "") +
        `width:${width}pt;height:${height};padding:0 3.5pt;` +
        border(firstCol, firstRow);

    const pAlign = align === "center" ? ` align="center"` : "";
    const pStyle = P_WRAP + (align === "center" ? "text-align:center;" : "");
    const span = `<span style="color:${color};font-size:${PT};font-family:${FONT};">${html}</span>`;
    const inner = bold ? `<b>${span}</b>` : span;

    return `<td${attrs} style="${tdStyle}"><p${pAlign} style="${pStyle}">${inner}</p></td>`;
}

const header = (html: string, width: number, extra: Partial<CellOptions> = {}) =>
    cell({ html, width, height: H_HEADER, background: C_HDR, bold: true, color: "white", ...extra });

function buildTable(schedule: Schedule): string {
    const totalWidth = W.id + W.task + W.status + W.start + W.end + W.duration + W.owner;

    let rows =
        `<tr style="height:${H_HEADER};">` +
        header("ID", W.id, { rowspan: 2, firstCol: true, firstRow: true }) +
        header("TAREAS A EJECUTAR EN VENTANA DE IMPLEMENTACIÓN", W.task, { rowspan: 2, firstRow: true }) +
        header("ESTADO", W.status, { rowspan: 2, firstRow: true }) +
        header("HORA", W.start + W.end, { colspan: 2, firstRow: true }) +
        header("Duración (mins)", W.duration, { rowspan: 2, firstRow: true }) +
        header("RESPONSABLE DE EJECUCIÓN", W.owner, { rowspan: 2, firstRow: true }) +
        `</tr>` +
        `<tr style="height:${H_HEADER};">` +
        header("INICIO", W.start) +
        header("FIN", W.end) +
        `</tr>`;

    for (const section of schedule.sections) {
        /* Separator row: 7 colored cells with the label in the 2nd one,
           like the real email (no colspan). */
        const sep = (width: number, extra: Partial<CellOptions> = {}) =>
            cell({ width, height: H_SECTION, background: C_SEC, ...extra });
        rows +=
            `<tr style="height:${H_SECTION};">` +
            sep(W.id, { firstCol: true }) +
            sep(W.task, { html: escapeHtml(section.name), bold: true, color: "white", align: "left" }) +
            sep(W.status) +
            sep(W.start) +
            sep(W.end) +
            sep(W.duration) +
            sep(W.owner) +
            `</tr>`;

        for (const step of section.steps) {
            const data = (html: string, width: number, extra: Partial<CellOptions> = {}) =>
                cell({ html, width, height: H_ROW, ...extra });
            rows +=
                `<tr style="height:${H_ROW};">` +
                data(String(step.number), W.id, { firstCol: true }) +
                data(escapeHtml(step.description), W.task, { align: "left" }) +
                data(STATUS, W.status, { align: "left" }) +
                data(step.start, W.start) +
                data(step.end, W.end) +
                data(String(step.duration), W.duration) +
                data(escapeHtml(step.owner) || "&nbsp;", W.owner) +
                `</tr>`;
        }
    }

    return (
        `<table border="0" cellspacing="0" cellpadding="0" ` +
        `style="width:${totalWidth}pt;border-spacing:0;border-collapse:collapse;">` +
        `<tbody>${rows}</tbody></table>`
    );
}

/** Title, window summary and table, ready to paste into Outlook. */
export function buildEmailHtml(title: string, schedule: Schedule): string {
    const heading =
        `<p style="${P_WRAP}"><b><span style="color:${C_HDR};font-size:12pt;font-family:${FONT};">` +
        `${escapeHtml(title)}</span></b></p>` +
        `<p style="${P_WRAP}"><span style="color:black;font-size:${PT};font-family:${FONT};">` +
        `Ventana: <b>${schedule.start}</b> a <b>${schedule.end}</b> &nbsp;|&nbsp; ` +
        `Duración total: <b>${schedule.totalMinutes} min</b>` +
        `</span></p><p style="${P_WRAP}">&nbsp;</p>`;
    return heading + buildTable(schedule);
}

/** Tab-separated version for the clipboard's text/plain flavor. */
export function buildPlainText(title: string, schedule: Schedule): string {
    const lines = [title, ""];
    for (const section of schedule.sections) {
        lines.push(`== ${section.name} ==`);
        for (const s of section.steps) {
            lines.push([s.number, s.description, STATUS, s.start, s.end, s.duration, s.owner].join("\t"));
        }
    }
    return lines.join("\n");
}
