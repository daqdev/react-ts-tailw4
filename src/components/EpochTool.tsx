import { useEffect, useState } from "react";

export default function EpochTool() {
    const [epochInput, setEpochInput] = useState("");
    const [convertedDate, setConvertedDate] = useState("");
    const [copyLabel, setCopyLabel] = useState("Copy");
    const [currentEpoch, setCurrentEpoch] = useState(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const interval = window.setInterval(() => {
            setCurrentEpoch(Math.floor(Date.now() / 1000));
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!epochInput.trim()) {
            setConvertedDate("");
            return;
        }

        const trimmed = epochInput.trim();
        const numericValue = Number(trimmed);

        if (Number.isNaN(numericValue)) {
            setConvertedDate("Invalid epoch value");
            return;
        }

        const epochMs = trimmed.length > 10 ? numericValue : numericValue * 1000;
        const parsedDate = new Date(epochMs);

        if (Number.isNaN(parsedDate.getTime())) {
            setConvertedDate("Invalid epoch value");
            return;
        }

        const formatted = parsedDate.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        setConvertedDate(formatted);
    }, [epochInput]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentEpoch.toString());
            setCopyLabel("Copied!");
            window.setTimeout(() => setCopyLabel("Copy"), 1500);
        } catch (error) {
            setCopyLabel("Failed");
            window.setTimeout(() => setCopyLabel("Copy"), 1500);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-slate-800">
                    Current Epoch (seconds)
                </h3>
                <div className="flex items-center gap-3">
                    <code className="rounded-md bg-slate-900 px-3 py-2 text-lg font-mono text-white">
                        {currentEpoch}
                    </code>
                    <button
                        onClick={handleCopy}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                        {copyLabel}
                    </button>
                    <button
                        onClick={() => setEpochInput(currentEpoch.toString())}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        Use current
                    </button>
                </div>
                <p className="text-sm text-slate-600">
                    The epoch above updates every second. Use the buttons to copy or populate the converter.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-700" htmlFor="epoch-input">
                    Epoch input (seconds or milliseconds)
                </label>
                <input
                    id="epoch-input"
                    value={epochInput}
                    onChange={(event) => setEpochInput(event.target.value)}
                    placeholder="1697040000"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {convertedDate && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {convertedDate}
                    </p>
                )}
            </div>
        </div>
    );
}
