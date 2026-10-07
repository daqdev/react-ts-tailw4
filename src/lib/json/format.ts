export interface FormatResult {
    text: string;
    /** Number literals kept exactly as written because JavaScript can't represent them. */
    keptNumbers: string[];
}

const isJsonWhitespace = (c: string | undefined) => c === " " || c === "\t" || c === "\n" || c === "\r";

/** Mantissa digits without sign, point, or leading/trailing zeros: "-0.0120e5" → "12". */
const significantDigits = (literal: string) =>
    literal
        .toLowerCase()
        .split("e")[0]
        .replace(/[-+.]/g, "")
        .replace(/^0+/, "")
        .replace(/0+$/, "");

/**
 * A string token without escapes or surrogates (emoji, lone halves) is already
 * written the way JSON.stringify would write it, so it can be copied as is.
 */
function needsRoundTrip(token: string): boolean {
    if (token.includes("\\")) return true;
    for (let k = 1; k < token.length - 1; k++) {
        const code = token.charCodeAt(k);
        if (code >= 0xd800 && code <= 0xdfff) return true;
    }
    return false;
}

/**
 * Same output as JSON.stringify for numbers JavaScript holds exactly; otherwise
 * the literal as written (e.g. 64-bit ids, which JSON.parse would round, or 1e400,
 * which would become null).
 */
function formatNumber(literal: string, kept: string[]): string {
    const value = Number(literal);
    if (Number.isFinite(value) && significantDigits(String(value)) === significantDigits(literal)) {
        return String(value);
    }
    kept.push(literal);
    return literal;
}

/**
 * Pretty-prints JSON with 2-space indentation, like JSON.stringify(JSON.parse(text), null, 2),
 * but by re-indenting the original text, so nothing is lost on the way through JavaScript values:
 * large numbers keep their digits, and duplicate or numeric keys keep their order.
 * Throws the browser's SyntaxError when the text isn't valid JSON.
 */
export function formatJson(text: string): FormatResult {
    JSON.parse(text); // validation: everything below can assume well-formed JSON

    const keptNumbers: string[] = [];
    let out = "";
    let depth = 0;
    const indents: string[] = [];
    const newline = () => (indents[depth] ??= "\n" + "  ".repeat(depth));

    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"') {
            // Closing quote: the next one not escaped by an odd run of backslashes.
            let end = i;
            for (;;) {
                end = text.indexOf('"', end + 1);
                let backslashes = 0;
                while (text[end - 1 - backslashes] === "\\") backslashes++;
                if (backslashes % 2 === 0) break;
            }
            const token = text.slice(i, end + 1);
            // Round trip so escapes come out as JSON.stringify writes them.
            out += needsRoundTrip(token) ? JSON.stringify(JSON.parse(token)) : token;
            i = end + 1;
        } else if (c === "{" || c === "[") {
            let next = i + 1;
            while (isJsonWhitespace(text[next])) next++;
            if (text[next] === "}" || text[next] === "]") {
                out += c + text[next]; // empty: "{}" / "[]"
                i = next + 1;
            } else {
                depth++;
                out += c + newline();
                i++;
            }
        } else if (c === "}" || c === "]") {
            depth--;
            out += newline() + c;
            i++;
        } else if (c === ",") {
            out += "," + newline();
            i++;
        } else if (c === ":") {
            out += ": ";
            i++;
        } else if (isJsonWhitespace(c)) {
            i++;
        } else {
            // true, false, null or a number
            let end = i;
            while (end < text.length && !isJsonWhitespace(text[end]) && !",:]}".includes(text[end])) end++;
            const literal = text.slice(i, end);
            out += c === "-" || (c >= "0" && c <= "9") ? formatNumber(literal, keptNumbers) : literal;
            i = end;
        }
    }

    return { text: out, keptNumbers };
}
