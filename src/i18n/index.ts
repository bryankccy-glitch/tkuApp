import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type AppLanguage = 'zh-TW' | 'en';
const KEY = 'tku.lang';

function initialLanguage(): AppLanguage {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'zh-TW' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return 'zh-TW';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

function syncDocumentLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng === 'en' ? 'en' : 'zh-Hant-TW';
}
syncDocumentLang(i18n.language);

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(KEY, lng);
  } catch {
    /* ignore */
  }
  syncDocumentLang(lng);
});

export default i18n;
