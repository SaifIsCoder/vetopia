import { create } from 'zustand';
import { SupportedLanguage } from '../../types/localization';
import { translations } from './translations';

interface LocalizationState {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

export const useLocalization = create<LocalizationState>((set, get) => ({
  currentLanguage: 'English',
  setLanguage: (currentLanguage) => set({ currentLanguage }),
  t: (key, fallback) => {
    const { currentLanguage } = get();
    const langDict = translations[currentLanguage] || translations.English;
    return langDict[key] || fallback || key;
  },
}));
