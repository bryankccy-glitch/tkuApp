import i18n from './index';

/**
 * Translate with the active language. Safe to call during render because the UI
 * re-mounts on language change (see LanguageRoot).
 */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options) as string;
}
