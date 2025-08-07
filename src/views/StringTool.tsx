import { useState, useEffect, useCallback } from 'react';
import InputPanel from '../components/InputPanel';
import ResultsPanel from '../components/ResultsPanel';
import './views.css';

export default function StringTool() {
    const [inputText, setInputText] = useState<string>('');
    const [parsedData, setParsedData] = useState<string[]>([]);
    const [separator, setSeparator] = useState<string>(',');
    const [quote, setQuote] = useState<string>('');
    const [formattedOutput, setFormattedOutput] = useState<string>('');
    const [showCopied, setShowCopied] = useState<boolean>(false);

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
        const handler = setTimeout(() => {
            analyzeData();
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [analyzeData]);

    useEffect(() => {
        updateFormattedOutput();
    }, [updateFormattedOutput]);

    return (
        <div className="view-block h-5 v-4">
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
        </div>
    );
}

