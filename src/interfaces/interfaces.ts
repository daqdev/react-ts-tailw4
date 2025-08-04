export interface InputPanelProps {
    inputText: string;
    setInputText: (text: string) => void;
    analyzeData: () => void;
    setSeparator: (sep: string) => void;
    setQuote: (q: string) => void;
    clearAll: () => void;
}

export interface ResultsPanelProps {
    parsedData: string[];
    formattedOutput: string;
    copyToClipboard: () => void;
    showCopied: boolean;
}