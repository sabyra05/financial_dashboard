import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { translations, type Language, type TranslationKey } from '../i18n/translations';

interface LanguageState {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const formatTranslation = (template: string, params?: Record<string, string | number>) => {
    if (!params) return template;

    return Object.entries(params).reduce((result, [key, value]) => {
        return result.replaceAll(`{${key}}`, String(value));
    }, template);
};

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            language: 'ru',
            setLanguage: (language) => set({ language }),
            t: (key, params) => {
                const language = get().language;
                const dict = translations[language];
                const value = dict[key as keyof typeof dict];
                const fallbackValue = translations.ru[key as keyof typeof translations.ru];
                const message = typeof value === 'string' ? value : typeof fallbackValue === 'string' ? fallbackValue : String(key);
                return formatTranslation(message, params);
            },
        }),
        {
            name: 'language-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
