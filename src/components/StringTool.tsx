import { useState, useEffect, useCallback } from 'react';
import InputPanel from './InputPanel';
import ResultsPanel from './ResultsPanel';
// import { useTranslation } from '../hooks/useTranslation';



export default function StringTool() {
    const [inputText, setInputText] = useState<string>('');
    const [parsedData, setParsedData] = useState<string[]>([]);
    const [separator, setSeparator] = useState<string>(',');
    const [quote, setQuote] = useState<string>('');
    const [formattedOutput, setFormattedOutput] = useState<string>('');
    const [showCopied, setShowCopied] = useState<boolean>(false);
    // const { t, toggleLanguage, currentLang } = useTranslation();

    const analyzeData = useCallback(() => {
        const text = inputText.trim();
        if (!text) {
            setParsedData([]);
            return;
        }

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const values = lines.flatMap(line =>
            line.split(',')
                .map(item => item.trim())
                .filter(item => item !== '')
                .map(item => {
                    if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                        return item.slice(1, -1).trim();
                    }
                    return item;
                })
        );
        setParsedData(values);
    }, [inputText]);

    const updateFormattedOutput = useCallback(() => {
        if (parsedData.length === 0) {
            setFormattedOutput('');
            return;
        }

        const sepStr = separator === ',' ? ', ' : '\n';
        let formattedString;

        if (quote) {
            formattedString = parsedData.map(item => `${quote}${item.replace(new RegExp(quote, 'g'), `\\${quote}`)}${quote}`).join(sepStr);
        } else {
            formattedString = parsedData.join(sepStr);
        }

        setFormattedOutput(formattedString);
    }, [parsedData, separator, quote]);

    const clearAll = () => {
        setInputText('');
        setParsedData([]);
        setFormattedOutput('');
    };

    const copyToClipboard = () => {
        if (!formattedOutput) return;
        navigator.clipboard.writeText(formattedOutput).then(() => {
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
        });
    };

    useEffect(() => {
        analyzeData();
    }, [analyzeData]);

    useEffect(() => {
        updateFormattedOutput();
    }, [updateFormattedOutput]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl items-stretch">
            <InputPanel
                inputText={inputText}
                setInputText={setInputText}
                analyzeData={analyzeData}
                setSeparator={setSeparator}
                setQuote={setQuote}
                clearAll={clearAll}
            />
            <ResultsPanel
                parsedData={parsedData}
                formattedOutput={formattedOutput}
                copyToClipboard={copyToClipboard}
                showCopied={showCopied}
            />
        </div>
    );
}
