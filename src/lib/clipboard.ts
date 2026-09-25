/**
 * Copies rich text (with a plain-text flavor) so it pastes formatted into
 * email editors. Falls back to selecting a hidden contenteditable copy when
 * the async Clipboard API is missing or refused.
 */
export async function copyHtml(html: string, text: string): Promise<boolean> {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([text], { type: "text/plain" }),
                }),
            ]);
            return true;
        } catch {
            // Fall through to the selection-based copy.
        }
    }

    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.style.cssText = "position:fixed;left:-99999px;top:0;opacity:0;";
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const selection = window.getSelection();
    try {
        const range = document.createRange();
        range.selectNodeContents(holder);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        selection?.removeAllRanges();
        holder.remove();
    }
}
