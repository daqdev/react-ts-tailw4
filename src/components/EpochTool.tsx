import { useEffect, useState } from "react";

export default function EpochTool() {
    const [epochInput, setEpochInput] = useState("");
    const [convertedDate, setConvertedDate] = useState("");
    const [copyLabel, setCopyLabel] = useState("Copy");
    const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
    const [useUtc, setUseUtc] = useState(false);
    const [useMilliseconds, setUseMilliseconds] = useState(false);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setCurrentTimestamp(Date.now());
        }, 250);

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

        const epochMs = useMilliseconds ? numericValue : numericValue * 1000;
        const parsedDate = new Date(epochMs);

        if (Number.isNaN(parsedDate.getTime())) {
            setConvertedDate("Invalid epoch value");
            return;
        }

        const options: Intl.DateTimeFormatOptions = {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
        };

        if (useUtc) {
            options.timeZone = "UTC";
        }

        const formatted = parsedDate.toLocaleString(undefined, options);

        setConvertedDate(formatted);
    }, [epochInput, useUtc, useMilliseconds]);

    const displayedEpoch = useMilliseconds
        ? Math.floor(currentTimestamp).toString()
        : Math.floor(currentTimestamp / 1000).toString();
    const inputPlaceholder = useMilliseconds ? "1697040000000" : "1697040000";

    const togglePrecision = () => {
        setUseMilliseconds((prev) => {
            setEpochInput((currentValue) => {
                if (!currentValue.trim()) {
                    return currentValue;
                }

                const numericValue = Number(currentValue);
                if (Number.isNaN(numericValue)) {
                    return currentValue;
                }

                if (prev) {
                    return Math.floor(numericValue / 1000).toString();
                }

                return Math.floor(numericValue * 1000).toString();
            });

            return !prev;
        });
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(displayedEpoch);
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
                    Current Epoch ({useMilliseconds ? "milliseconds" : "seconds"})
                </h3>
                <div className="flex items-center gap-3">
                    <code className="rounded-md bg-slate-900 px-3 py-2 text-lg font-mono text-white">
                        {displayedEpoch}
                    </code>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                        {copyLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => setEpochInput(displayedEpoch)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        Use current
                    </button>
                    <button
                        type="button"
                        onClick={togglePrecision}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        {useMilliseconds ? "Show seconds" : "Show milliseconds"}
                    </button>
                </div>
                <p className="text-sm text-slate-600">
                    The epoch above updates continuously. Use the buttons to copy, populate the converter, or switch between seconds and milliseconds.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-700" htmlFor="epoch-input">
                    Epoch input ({useMilliseconds ? "milliseconds" : "seconds"})
                </label>
                <input
                    id="epoch-input"
                    value={epochInput}
                    onChange={(event) => setEpochInput(event.target.value)}
                    placeholder={inputPlaceholder}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setUseUtc((prev) => !prev)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        {useUtc ? "Show local time" : "Show UTC"}
                    </button>
                    <span className="text-xs text-slate-500">
                        Currently showing {useUtc ? "UTC" : "local"} time
                    </span>
                <div 
                className="rounded-md bg-slate-50 px-4 py-2 text-sm min-h-[1rem] flex items-right">
                    {convertedDate || (
                        <span className="text-blue-900">
                            Converted date will appear here
                        </span>
                    )}
                </div>
                    </div>
            </div>
        </div>
    );
}
