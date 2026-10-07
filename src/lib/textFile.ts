export type TextEncodingName = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

/**
 * Decodes a dropped text file. Honors a byte order mark, then tries UTF-8 and,
 * if the bytes aren't valid UTF-8, falls back to Windows-1252 ("ANSI"), the
 * usual encoding of files saved by older Notepad or Excel on Windows.
 */
export function decodeTextFile(buffer: ArrayBuffer): { text: string; encoding: TextEncodingName } {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
    try {
        // Also strips a UTF-8 byte order mark.
        return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
    } catch {
        return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
    }
}
