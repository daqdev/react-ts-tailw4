/*
 * Characters that word processors, chat apps and web pages slip into copied
 * text and that make otherwise valid JSON fail to parse.
 */

const SMART_DOUBLE_QUOTES = /[\u201c\u201d\u201e\u201f]/g;
/** No-break, figure and narrow no-break spaces. */
const SPECIAL_SPACES = /[\u00a0\u2007\u202f]/g;
/** Zero-width space and byte order mark. Not U+200D: emoji sequences need it. */
const INVISIBLE = /[\u200b\ufeff]/g;

export interface PasteArtifacts {
    smartQuotes: number;
    specialSpaces: number;
    invisible: number;
    total: number;
}

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

export function findPasteArtifacts(text: string): PasteArtifacts {
    const smartQuotes = count(text, SMART_DOUBLE_QUOTES);
    const specialSpaces = count(text, SPECIAL_SPACES);
    const invisible = count(text, INVISIBLE);
    return { smartQuotes, specialSpaces, invisible, total: smartQuotes + specialSpaces + invisible };
}

/** Straight quotes for curly double quotes, plain spaces for special ones, invisible characters removed. */
export function cleanPasteArtifacts(text: string): string {
    return text.replace(SMART_DOUBLE_QUOTES, '"').replace(SPECIAL_SPACES, " ").replace(INVISIBLE, "");
}
