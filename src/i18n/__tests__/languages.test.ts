import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n, { intlLocale, setLanguage } from '../index';
import zhTW from '../locales/zh-TW';
import zhCN from '../locales/zh-CN';

const flatKeys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${p}${k}`] : flatKeys(v as object, `${p}${k}.`)));

describe('languages', () => {
  afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage('zh-TW'); });

  it('Simplified Chinese has every key of Traditional Chinese', () => {
    expect(flatKeys(zhCN)).toEqual(flatKeys(zhTW));
    expect(zhCN.nav.schedule).not.toBe('');
  });

  it('switches to a machine-translated language via /api/translate and falls back to English', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version: 'abcdefabcdef', data: { nav: { home: 'ホーム' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await setLanguage('ja');
    expect(fetchMock).toHaveBeenCalledWith('/api/translate?lang=ja', expect.anything());
    expect(i18n.t('nav.home')).toBe('ホーム');
    expect(i18n.t('nav.schedule')).toBe(i18n.getFixedT('en')('nav.schedule')); // untranslated → English
    expect(intlLocale()).toBe('ja-JP');
    expect(document.documentElement.lang).toBe('ja');
  });

  it('keeps the current language when a pack cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(setLanguage('ko')).rejects.toThrow();
    expect(i18n.language).toBe('zh-TW');
  });
});
