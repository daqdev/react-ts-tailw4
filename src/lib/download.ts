/** Saves text as a file through a temporary object URL. */
export function downloadText(filename: string, text: string, type = "application/json"): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    // Revoking right away can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
