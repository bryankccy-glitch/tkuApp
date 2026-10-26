import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW';
import zhCN from './locales/zh-CN';
import en from './locales/en';
import { RTL, isBuiltIn, isSupported, languageInfo } from './languages';

export const resources = { 'zh-TW': { translation: zhTW }, 'zh-CN': { translation: zhCN }, en: { translation: en } } as const;

/** Any code from LANGUAGES. */
export type AppLanguage = string;
const KEY = 'tku.lang';

/**
 * Translations for the other languages ship with the app as static files (src/i18n/packs/*.ts),
 * loaded on demand — no translation service, no API key. Missing strings fall back to English.
 */
const PACKS = import.meta.glob<{ default: Record<string, unknown> }>('./packs/*.ts');
const packLoader = (code: string) => PACKS[`./packs/${code}.ts`];
export const hasPack = (code: string) => Boolean(packLoader(code));

function initialLanguage(): AppLanguage {
  try {
    // Packs cached by older versions (machine translation from a server) are no longer used.
    for (const k of Object.keys(localStorage)) if (k.startsWith('tku.lang.pack.')) localStorage.removeItem(k);
    const v = localStorage.getItem(KEY);
    if (v && isSupported(v) && (isBuiltIn(v) || hasPack(v))) return v;
  } catch {
    /* ignore */
  }
  return 'zh-TW';
}

const lng = initialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng,
  // Other languages fall back to English; Simplified to Traditional Chinese.
  fallbackLng: (code: string) => (code === 'zh-TW' ? [] : code === 'zh-CN' ? ['zh-TW'] : ['en', 'zh-TW']),
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

async function loadPack(code: string): Promise<void> {
  if (isBuiltIn(code) || i18n.hasResourceBundle(code, 'translation')) return;
  const load = packLoader(code);
  if (!load) throw new Error(`no translation for ${code}`);
  const mod = await load();
  i18n.addResourceBundle(code, 'translation', mod.default, true, true);
}
// A saved non-built-in language: English shows for a moment until its pack has loaded.
if (!isBuiltIn(lng)) void loadPack(lng).then(() => i18n.changeLanguage(lng)).catch(() => i18n.changeLanguage('zh-TW'));

/** Intl locale for dates/numbers in the current language. */
export function intlLocale(code: string = i18n.language): string {
  return languageInfo(code)?.intl ?? 'zh-TW';
}
/** Chinese UI (shows Chinese-only official titles as is). */
export const isChinese = (code: string = i18n.language) => code.startsWith('zh');

function syncDocumentLang(code: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = code === 'zh-TW' ? 'zh-Hant-TW' : code === 'zh-CN' ? 'zh-Hans-CN' : code;
  document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
}
syncDocumentLang(i18n.language);

i18n.on('languageChanged', (code) => {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* ignore */
  }
  syncDocumentLang(code);
});

/** Switches language, loading its translation file first when needed (throws if it can't be loaded). */
export async function setLanguage(code: string): Promise<void> {
  if (!isSupported(code)) throw new Error(`unsupported language ${code}`);
  await loadPack(code);
  await i18n.changeLanguage(code);
}

export default i18n;
