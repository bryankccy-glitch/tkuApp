import { afterEach, describe, expect, it } from 'vitest';
import i18n, { hasPack, intlLocale, setLanguage } from '../index';
import { LANGUAGES, isBuiltIn } from '../languages';
import zhTW from '../locales/zh-TW';
import zhCN from '../locales/zh-CN';
import en from '../locales/en';

type Tree = { [k: string]: string | Tree };
const flat = (o: Tree, p = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[`${p}${k}`] = v;
    else flat(v, `${p}${k}.`, out);
  }
  return out;
};
const placeholders = (s: string) => (s.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort().join('|');
const packs = import.meta.glob<{ default: Tree }>('../packs/*.ts', { eager: true });

describe('languages', () => {
  afterEach(async () => { await i18n.changeLanguage('zh-TW'); });

  it('Simplified Chinese has every key of Traditional Chinese', () => {
    expect(Object.keys(flat(zhCN as unknown as Tree))).toEqual(Object.keys(flat(zhTW as unknown as Tree)));
  });

  it('every offered language ships a translation file (no translation service)', () => {
    for (const l of LANGUAGES.filter((x) => !isBuiltIn(x.code))) expect(hasPack(l.code), l.code).toBe(true);
    expect(Object.keys(packs).length).toBe(LANGUAGES.filter((x) => !isBuiltIn(x.code)).length);
  });

  it.each(Object.entries(packs))('%s: only known keys, same placeholders, nearly complete', (_file, mod) => {
    const source = flat(en as unknown as Tree);
    const pack = flat(mod.default);
    for (const [k, v] of Object.entries(pack)) {
      expect(source[k], `unknown key ${k}`).toBeDefined();
      expect(placeholders(v), k).toBe(placeholders(source[k]!));
      expect(v.trim(), k).not.toBe('');
    }
    expect(Object.keys(pack).length / Object.keys(source).length).toBeGreaterThan(0.97);
  });

  it('switches to a shipped language without any network request', async () => {
    const fetchSpy = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response(''); }) as typeof fetch;
    try {
      await setLanguage('ja');
      expect(i18n.t('nav.home')).toBe('ホーム');
      expect(intlLocale()).toBe('ja-JP');
      expect(document.documentElement.lang).toBe('ja');
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = fetchSpy;
    }
  });

  it('rejects languages that are not offered', async () => {
    await expect(setLanguage('xx')).rejects.toThrow();
    expect(i18n.language).toBe('zh-TW');
  });
});
