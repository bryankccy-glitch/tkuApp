/**
 * Interface languages. zh-TW and en are hand-written, zh-CN is generated from zh-TW
 * (scripts/make-zh-cn.py); the others are pre-translated files in src/i18n/packs/ that ship with
 * the app — no translation service at run time. A language is offered only if its file exists
 * (checked by a test). Plain data.
 */
export interface LanguageInfo {
  code: string;
  /** Name in the language itself. */
  name: string;
  /** English name. */
  english: string;
  builtIn?: boolean;
  /** BCP-47 tag for Intl date/number formatting. */
  intl: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'zh-TW', name: '繁體中文', english: 'Traditional Chinese (Taiwan)', builtIn: true, intl: 'zh-TW' },
  { code: 'zh-CN', name: '简体中文', english: 'Simplified Chinese', builtIn: true, intl: 'zh-CN' },
  { code: 'en', name: 'English', english: 'English', builtIn: true, intl: 'en-US' },
  { code: 'ja', name: '日本語', english: 'Japanese', intl: 'ja-JP' },
  { code: 'ko', name: '한국어', english: 'Korean', intl: 'ko-KR' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese', intl: 'vi-VN' },
  { code: 'th', name: 'ไทย', english: 'Thai', intl: 'th-TH' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian', intl: 'id-ID' },
  { code: 'es', name: 'Español', english: 'Spanish', intl: 'es-ES' },
];

/** Right-to-left languages (none shipped at the moment; kept for when one is added). */
export const RTL = new Set<string>(['ar', 'fa', 'he']);
export const languageInfo = (code: string) => LANGUAGES.find((l) => l.code === code);
export const isBuiltIn = (code: string) => Boolean(languageInfo(code)?.builtIn);
export const isSupported = (code: string) => Boolean(languageInfo(code));
