import { useTranslation } from '../hooks/useTranslation';
import ResultsFeed from './ResultsFeed';

export default function ResultsPanel({ parsedData, formattedOutput, copyToClipboard, showCopied }) {
    const { t } = useTranslation();

    return (
        <div className="card p-8 flex flex-col h-full">
            <div className="flex items-center mb-6">
                <div className="bg-green-100 text-green-600 p-2 rounded-lg mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800">{t('results')}</h1>
            </div>

            {parsedData.length > 0 ? (
                <>
                    <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-4 text-sm flex items-center">
                        <i className="fas fa-check-circle mr-2"></i>
                        <span>{t('detection', { count: parsedData.length })}</span>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2" style={{ height: '150px' }}>
                        <ResultsFeed parsedData={parsedData} />
                    </div>

                    {formattedOutput && (
                        <div className="mt-6 relative">
                            <div className="relative">
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('formattedOutput')}:</h3>
                                <button onClick={copyToClipboard} className="absolute top-1 right-3 text-gray-400 hover:text-black transition" title="Copy to clipboard">
                                    <i className="far fa-copy fa-lg"></i>
                                </button>
                            </div>
                            <textarea
                                readOnly
                                value={formattedOutput}
                                onClick={copyToClipboard}
                                className="w-full bg-gray-900 text-green-400 font-mono text-sm border border-gray-700 rounded-xl p-4 pr-12 focus:outline-none resize-none cursor-pointer"
                                style={{ height: '150px' }}
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-2 text-center">{t('copyHint')}</p>
                            {showCopied && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white text-sm px-4 py-2 rounded-lg shadow pointer-events-none">
                                    {t('copyGreeting')}
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-lg font-semibold">No results to display</p>
                    <p className="text-sm">Enter some text to get started</p>
                </div>
            )}
        </div>
    );
}
