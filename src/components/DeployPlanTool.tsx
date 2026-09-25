import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, SyntheticEvent } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { copyHtml } from "../lib/clipboard";
import { downloadText } from "../lib/download";
import { buildEmailHtml, buildPlainText } from "../lib/deployPlan/email";
import {
    examplePlan,
    isValidDuration,
    loadStoredPlan,
    MAX_DURATION,
    normalizeOwners,
    parsePlanJson,
    serializePlan,
    storePlan,
} from "../lib/deployPlan/planFile";
import { planReducer } from "../lib/deployPlan/reducer";
import { schedulePlan } from "../lib/deployPlan/schedule";
import { normalizeTime } from "../lib/deployPlan/time";

const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400";
const invalidClass = "border-red-500 focus:border-red-500 focus:ring-red-300";
const buttonClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300";
const iconButtonClass =
    "rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent";

interface DraftInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur"> {
    value: string;
    /** The value to commit for this text, or null while it's invalid. */
    parse: (text: string) => string | null;
    onCommit: (value: string) => void;
    error?: string;
}

/**
 * Input that keeps what the user types while it's invalid (and marks it),
 * commits every valid value, and shows the committed value again on blur.
 */
function DraftInput({ value, parse, onCommit, error, className = "", ...rest }: DraftInputProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const invalid = draft !== null && parse(draft) === null;

    return (
        <>
            <input
                {...rest}
                value={draft ?? value}
                aria-invalid={invalid}
                title={invalid ? error : rest.title}
                className={`${inputClass} ${invalid ? invalidClass : ""} ${className}`}
                onChange={(e) => {
                    const text = e.target.value;
                    setDraft(text);
                    const parsed = parse(text);
                    if (parsed !== null && parsed !== value) onCommit(parsed);
                }}
                onBlur={() => setDraft(null)}
            />
            {invalid && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </>
    );
}

const parseDuration = (text: string) => {
    const trimmed = text.trim();
    return /^\d+$/.test(trimmed) && isValidDuration(Number(trimmed)) ? String(Number(trimmed)) : null;
};

const fileNameFor = (title: string) =>
    (title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "plan-de-despliegue") + ".json";

/** Grows the preview iframe to its content so the card scrolls, not the frame. */
function fitIframe(e: SyntheticEvent<HTMLIFrameElement>) {
    const doc = e.currentTarget.contentDocument;
    if (doc) e.currentTarget.style.height = `${doc.documentElement.scrollHeight}px`;
}

export default function DeployPlanTool() {
    const { t } = useTranslation();
    const [plan, dispatch] = useReducer(planReducer, undefined, () => loadStoredPlan() ?? examplePlan());
    const [showHtml, setShowHtml] = useState(false);
    const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => storePlan(plan), [plan]);

    useEffect(() => {
        if (!copyStatus) return;
        const timer = window.setTimeout(() => setCopyStatus(null), 3500);
        return () => window.clearTimeout(timer);
    }, [copyStatus]);

    const schedule = useMemo(() => schedulePlan(plan), [plan]);
    const html = useMemo(() => buildEmailHtml(plan.title, schedule), [plan.title, schedule]);
    const previewDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff">${html}</body></html>`;

    const handleCopy = async () => {
        setCopyStatus((await copyHtml(html, buildPlainText(plan.title, schedule))) ? "copied" : "failed");
    };

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // so the same file can be loaded again
        if (!file) return;
        let result: ReturnType<typeof parsePlanJson>;
        try {
            result = parsePlanJson(await file.text());
        } catch {
            result = { error: "the file could not be read" };
        }
        if ("error" in result) {
            setNotice({ ok: false, text: t("deployLoadError", { file: file.name, error: result.error }) });
        } else {
            dispatch({ type: "replace", plan: result.plan });
            setNotice({ ok: true, text: t("deployLoaded", { file: file.name }) });
        }
    };

    const handleReset = () => {
        if (!window.confirm(t("deployResetConfirm"))) return;
        dispatch({ type: "replace", plan: examplePlan() });
        setNotice(null);
    };

    const sectionTotals = schedule.sections.filter((s) => s.steps.length > 0);

    // The app caps #root at 1280px: too narrow for the editor next to the ~880px email table,
    // so the preview goes below it. `text-left` undoes #root's centered text.
    return (
        <div className="flex flex-col gap-6 text-left">
            {/* ====== Editor ====== */}
            <div className="flex min-w-0 flex-col gap-4">
                <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
                    <label className="text-xs font-semibold text-slate-700">
                        {t("deployTitle")}
                        <input
                            value={plan.title}
                            onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
                            className={`${inputClass} mt-1 font-normal`}
                        />
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                        {t("deployStartTime")}
                        <DraftInput
                            value={plan.startTime}
                            parse={normalizeTime}
                            onCommit={(startTime) => dispatch({ type: "setStartTime", startTime })}
                            error={t("deployStartTimeInvalid")}
                            inputMode="numeric"
                            placeholder="22:00"
                            className="mt-1 font-normal"
                        />
                    </label>
                </div>
                <p className="-mt-2 text-xs text-slate-500">{t("deployMidnightHint")}</p>

                <label className="text-xs font-semibold text-slate-700">
                    {t("deployOwners")}
                    <DraftInput
                        value={plan.owners.join(", ")}
                        parse={(text) => text}
                        onCommit={(text) => dispatch({ type: "setOwners", owners: normalizeOwners(text.split(",")) })}
                        className="mt-1 font-normal"
                    />
                </label>

                {plan.sections.map((section) => (
                    <div key={section.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-1 text-sm font-bold uppercase tracking-wide text-[#0F243E]">
                            {section.name}
                        </div>
                        {section.steps.map((step, index) => {
                            const owners = plan.owners.includes(step.owner) || !step.owner
                                ? plan.owners
                                : [...plan.owners, step.owner];
                            return (
                                <div
                                    key={step.id}
                                    className="grid grid-cols-[1.25rem_minmax(0,1fr)_4rem_9rem_auto] items-start gap-1.5 border-b border-dashed border-slate-200 py-1.5"
                                >
                                    <span className="pt-2 text-center text-xs text-slate-400">{index + 1}</span>
                                    <input
                                        value={step.description}
                                        placeholder={t("deployStepPlaceholder")}
                                        aria-label={t("deployStepPlaceholder")}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "updateStep",
                                                sectionId: section.id,
                                                stepId: step.id,
                                                patch: { description: e.target.value },
                                            })
                                        }
                                        className={inputClass}
                                    />
                                    <div>
                                        <DraftInput
                                            value={String(step.duration)}
                                            parse={parseDuration}
                                            onCommit={(v) =>
                                                dispatch({
                                                    type: "updateStep",
                                                    sectionId: section.id,
                                                    stepId: step.id,
                                                    patch: { duration: Number(v) },
                                                })
                                            }
                                            error={t("deployDurationInvalid", { max: String(MAX_DURATION) })}
                                            inputMode="numeric"
                                            title={t("deployDuration")}
                                            aria-label={t("deployDuration")}
                                            className="text-right"
                                        />
                                    </div>
                                    <select
                                        value={step.owner}
                                        aria-label={t("deployOwner")}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "updateStep",
                                                sectionId: section.id,
                                                stepId: step.id,
                                                patch: { owner: e.target.value },
                                            })
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">—</option>
                                        {owners.map((owner) => (
                                            <option key={owner} value={owner}>
                                                {owner}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex pt-1">
                                        <button
                                            type="button"
                                            className={iconButtonClass}
                                            title={t("deployMoveUp")}
                                            aria-label={t("deployMoveUp")}
                                            disabled={index === 0}
                                            onClick={() =>
                                                dispatch({ type: "moveStep", sectionId: section.id, stepId: step.id, offset: -1 })
                                            }
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className={iconButtonClass}
                                            title={t("deployMoveDown")}
                                            aria-label={t("deployMoveDown")}
                                            disabled={index === section.steps.length - 1}
                                            onClick={() =>
                                                dispatch({ type: "moveStep", sectionId: section.id, stepId: step.id, offset: 1 })
                                            }
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className={`${iconButtonClass} text-red-500 hover:text-red-700`}
                                            title={t("deployRemove")}
                                            aria-label={t("deployRemove")}
                                            onClick={() =>
                                                dispatch({ type: "removeStep", sectionId: section.id, stepId: step.id })
                                            }
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => dispatch({ type: "addStep", sectionId: section.id })}
                            className="mt-2 w-full rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F243E] hover:bg-slate-300"
                        >
                            + {t("deployAddStep", { section: section.name })}
                        </button>
                    </div>
                ))}

                {sectionTotals.length > 0 && (
                    <p className="text-sm text-slate-600">
                        <b>{t("deployTotals")}</b>{" "}
                        {sectionTotals.map((s) => `${s.name}: ${s.minutes} min`).join(" · ")} →{" "}
                        <b>{t("deployTotal", { minutes: String(schedule.totalMinutes) })}</b>
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                        {t("deployCopy")}
                    </button>
                    <button type="button" onClick={() => setShowHtml((v) => !v)} className={buttonClass}>
                        {showHtml ? t("deployHideHtml") : t("deployShowHtml")}
                    </button>
                    {copyStatus && (
                        <span
                            role="status"
                            className={`text-sm font-semibold ${copyStatus === "copied" ? "text-emerald-700" : "text-red-600"}`}
                        >
                            {copyStatus === "copied" ? t("deployCopied") : t("deployCopyFailed")}
                        </span>
                    )}
                </div>
                {showHtml && (
                    <textarea
                        readOnly
                        value={html}
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-36 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-[10px]"
                    />
                )}
                <p className="text-xs text-slate-500">{t("deployPasteHint")}</p>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                    <button
                        type="button"
                        onClick={() => downloadText(fileNameFor(plan.title), serializePlan(plan))}
                        className={buttonClass}
                    >
                        {t("deploySaveJson")}
                    </button>
                    <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
                        {t("deployLoadJson")}
                    </button>
                    <button type="button" onClick={handleReset} className={buttonClass}>
                        {t("deployReset")}
                    </button>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="application/json,.json"
                        onChange={handleFile}
                        className="hidden"
                    />
                </div>
                {notice && (
                    <p role="status" className={`text-sm ${notice.ok ? "text-emerald-700" : "text-red-600"}`}>
                        {notice.text}
                    </p>
                )}
                <p className="text-xs text-slate-500">{t("deployStorageHint")}</p>
            </div>

            {/* ====== Preview: an iframe, so Tailwind's reset doesn't touch the email markup ====== */}
            <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("deployPreview")}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <iframe
                        title={t("deployPreview")}
                        srcDoc={previewDoc}
                        sandbox="allow-same-origin"
                        onLoad={fitIframe}
                        className="block h-96 w-full min-w-[880px] border-0"
                    />
                </div>
            </div>
        </div>
    );
}
