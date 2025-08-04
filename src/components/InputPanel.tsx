import { useTranslation } from '../hooks/useTranslation';
import SegmentedControl from './SegmentedControl';

export default function InputPanel({ inputText, setInputText, analyzeData, setSeparator, setQuote, clearAll }) {
    const { t } = useTranslation();

    const quoteOptions = [
        { label: t('quoteSingle'), value: "'" },
        { label: t('quoteDouble'), value: '"' },
        { label: t('noQuotes'), value: '' },
    ];

    const separatorOptions = [
        { label: t('separatorComma'), value: ',' },
        { label: t('separatorNewline'), value: '\n' },
    ];

    return (
        <div className="card p-8 flex flex-col">
            <div className="flex items-center mb-6">
                <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-4">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">
                    {t("inputText")}
                </h1>
            </div>
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition resize-none"
                style={{ height: "300px" }}
                placeholder={t("placeholder")}
            ></textarea>
            <div className="grid grid-cols-1 gap-4 mt-6">
                <SegmentedControl options={quoteOptions} onChange={setQuote} />
            </div>
            <div className="grid grid-cols-4 gap-1 mt-4">
                <div className="col-span-2">
                    <SegmentedControl
                        options={separatorOptions}
                        onChange={setSeparator}
                    />
                </div>
                <div className="col-span-1">
                    <button
                        onClick={analyzeData}
                        className="inline-flex items-center justify-center rounded-l-xl border border-indigo-600 bg-indigo-600 px-3 py-3 text-sm font-medium text-white transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring active:bg-indigo-700"
                    >
                        <span className="flex items-center">
                            {t("analyzeData")}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="3"
                                stroke="currentColor"
                                className="size-4 ml-2 rtl:rotate-180"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="m7.49 12-3.75 3.75m0 0 3.75 3.75m-3.75-3.75h16.5V4.499"
                                />
                            </svg>
                        </span>
                    </button>
                </div>
                <div className="col-span-1">
                    <button
                        onClick={clearAll}
                        className="inline-block rounded-r-xl border border-current px-8 py-3 text-sm font-medium text-red-600 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring active:text-amber-600"
                    >
                        <span className="flex items-center">
                        {t("clear")}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            className="ml-2 size-5 rtl:rotate-180"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                        </svg>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}