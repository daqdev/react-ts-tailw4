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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">{t('inputText')}</h1>
            </div>
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition resize-none"
                style={{ height: '300px' }}
                placeholder={t('placeholder')}
            ></textarea>
            <div className="grid grid-cols-1 gap-4 mt-6">
                <SegmentedControl options={quoteOptions} onChange={setQuote} />
            </div>
            <div className="grid grid-cols-5 gap-4 mt-4">
                <div className="col-span-2">
                    <SegmentedControl options={separatorOptions} onChange={setSeparator} />
                </div>
                <div className="col-span-1">
                    <button
                        onClick={analyzeData}
                        className="inline-block rounded bg-indigo-600 px-8 py-3 text-sm font-medium text-white transition hover:scale-110 hover:shadow-xl focus:outline-none focus:ring active:bg-indigo-500"
                    >
                        {t('analyzeData')}
                    </button>
                </div>
                <div className="col-span-2">
                    <button
                        onClick={clearAll}
                        className="inline-block rounded border border-current px-8 py-3 text-sm font-medium text-indigo-600 transition hover:scale-110 hover:shadow-xl focus:outline-none focus:ring active:text-indigo-500"
                    >
                        {t('clear')}
                    </button>
                </div>
            </div>
        </div>
    );
}