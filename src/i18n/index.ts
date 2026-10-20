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
const PACK = (lng: string) => `tku.lang.pack.${lng}`;

/** Language packs fetched from /api/translate, cached per browser. */
interface Pack { version: string; data: Record<string, unknown> }
function readPack(lng: string): Pack | null {
  try {
    const raw = localStorage.getItem(PACK(lng));
    return raw ? (JSON.parse(raw) as Pack) : null;
  } catch {
    return null;
  }
}

function initialLanguage(): AppLanguage {
  try {
    const v = localStorage.getItem(KEY);
    if (v && isSupported(v) && (isBuiltIn(v) || readPack(v))) return v;
  } catch {
    /* ignore */
  }
  return 'zh-TW';
}

const lng = initialLanguage();
const cached = isBuiltIn(lng) ? null : readPack(lng);

void i18n.use(initReactI18next).init({
  resources: cached ? { ...resources, [lng]: { translation: cached.data } } : resources,
  lng,
  // Machine-translated packs fall back to English; Simplified to Traditional Chinese.
  fallbackLng: (code: string) => (code === 'zh-TW' ? [] : code === 'zh-CN' ? ['zh-TW'] : ['en', 'zh-TW']),
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

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

/**
 * Switches language, downloading the machine-translated pack first when needed.
 * Throws if the pack can't be loaded (the language stays unchanged).
 */
export async function setLanguage(code: string): Promise<void> {
  if (!isSupported(code)) throw new Error(`unsupported language ${code}`);
  if (!isBuiltIn(code) && !i18n.hasResourceBundle(code, 'translation')) {
    const local = readPack(code);
    const res = await fetch(`/api/translate?lang=${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } }).catch(() => null);
    let pack: Pack | null = local;
    if (res?.ok) {
      pack = (await res.json()) as Pack;
      try { localStorage.setItem(PACK(code), JSON.stringify(pack)); } catch { /* storage full: still usable this session */ }
    }
    if (!pack) throw new Error('translation unavailable');
    i18n.addResourceBundle(code, 'translation', pack.data, true, true);
  }
  await i18n.changeLanguage(code);
}

/** Refresh a cached machine-translated pack in the background (new app version → new strings). */
export async function refreshLanguagePack(code: string = i18n.language): Promise<void> {
  if (isBuiltIn(code)) return;
  try {
    const res = await fetch(`/api/translate?lang=${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const pack = (await res.json()) as Pack;
    if (pack.version === readPack(code)?.version) return;
    localStorage.setItem(PACK(code), JSON.stringify(pack));
    i18n.addResourceBundle(code, 'translation', pack.data, true, true);
  } catch {
    /* offline */
  }
}

export default i18n;
