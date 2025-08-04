import { useState, useCallback } from 'react';
import { translations } from '../translations';

const langOrder = ['en', 'es', 'pt'];

export function useTranslation() {
    const [currentLang, setCurrentLang] = useState('en');

    const t = useCallback((key: string, params: { [key: string]: string } = {}) => {
        let str:string = translations[currentLang][key] || key;
        for (const p in params) {
            str = str.replace(`{${p}}`, params[p]);
        }
        return str;
    }, [currentLang]);

    const toggleLanguage = useCallback(() => {
        const next = (langOrder.indexOf(currentLang) + 1) % langOrder.length;
        setCurrentLang(langOrder[next]);
    }, [currentLang]);

    return { t, toggleLanguage, currentLang };
}
