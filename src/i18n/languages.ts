/**
 * Interface languages. Built-in ones ship with the app (zh-TW and en hand-written, zh-CN generated
 * from zh-TW). The rest are machine-translated from English on first use by /api/translate
 * (Gemini), cached on the server and in the browser, and marked as machine translation in the UI.
 * Plain data — also imported by api/translate.ts.
 */
export interface LanguageInfo {
  code: string;
  /** Name in the language itself. */
  name: string;
  /** English name, for the translation prompt. */
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
  { code: 'ms', name: 'Bahasa Melayu', english: 'Malay', intl: 'ms-MY' },
  { code: 'fil', name: 'Filipino', english: 'Filipino (Tagalog)', intl: 'fil-PH' },
  { code: 'my', name: 'မြန်မာ', english: 'Burmese', intl: 'my-MM' },
  { code: 'km', name: 'ខ្មែរ', english: 'Khmer', intl: 'km-KH' },
  { code: 'mn', name: 'Монгол', english: 'Mongolian', intl: 'mn-MN' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', intl: 'hi-IN' },
  { code: 'ne', name: 'नेपाली', english: 'Nepali', intl: 'ne-NP' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', intl: 'bn-BD' },
  { code: 'es', name: 'Español', english: 'Spanish', intl: 'es-ES' },
  { code: 'pt', name: 'Português', english: 'Portuguese (Brazil)', intl: 'pt-BR' },
  { code: 'fr', name: 'Français', english: 'French', intl: 'fr-FR' },
  { code: 'de', name: 'Deutsch', english: 'German', intl: 'de-DE' },
  { code: 'it', name: 'Italiano', english: 'Italian', intl: 'it-IT' },
  { code: 'nl', name: 'Nederlands', english: 'Dutch', intl: 'nl-NL' },
  { code: 'pl', name: 'Polski', english: 'Polish', intl: 'pl-PL' },
  { code: 'cs', name: 'Čeština', english: 'Czech', intl: 'cs-CZ' },
  { code: 'sv', name: 'Svenska', english: 'Swedish', intl: 'sv-SE' },
  { code: 'ru', name: 'Русский', english: 'Russian', intl: 'ru-RU' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian', intl: 'uk-UA' },
  { code: 'tr', name: 'Türkçe', english: 'Turkish', intl: 'tr-TR' },
  { code: 'ar', name: 'العربية', english: 'Arabic', intl: 'ar', },
  { code: 'fa', name: 'فارسی', english: 'Persian', intl: 'fa-IR' },
  { code: 'he', name: 'עברית', english: 'Hebrew', intl: 'he-IL' },
];

export const RTL = new Set(['ar', 'fa', 'he']);
export const languageInfo = (code: string) => LANGUAGES.find((l) => l.code === code);
export const isBuiltIn = (code: string) => Boolean(languageInfo(code)?.builtIn);
export const isSupported = (code: string) => Boolean(languageInfo(code));
