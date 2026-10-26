import { describe, expect, it } from 'vitest';
import { SOURCE, VERSION, acceptTranslation, flatten, mergeStale, translateAll, unflatten, untranslatedPhrases, withDeadline } from '../translate.js';

describe('translate', () => {
  it('round-trips nested strings', () => {
    const obj = { a: { b: 'x', c: { d: 'y' } }, e: 'z' };
    expect(unflatten(flatten(obj))).toEqual(obj);
    expect(Object.keys(SOURCE).length).toBeGreaterThan(500);
    expect(VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it('keeps English when placeholders are lost or the value is empty', () => {
    expect(acceptTranslation('{{count}} tasks', '{{count}} 件')).toBe('{{count}} 件');
    expect(acceptTranslation('{{count}} tasks', '件')).toBe('{{count}} tasks');
    expect(acceptTranslation('Hello', '')).toBe('Hello');
    expect(acceptTranslation('Hello', 42)).toBe('Hello');
  });

  it('translates every key in chunks and falls back per chunk on bad JSON', async () => {
    let calls = 0;
    const out = await translateAll('Japanese', async (prompt) => {
      calls += 1;
      const chunk = JSON.parse(prompt.slice(prompt.indexOf('\n{'))) as Record<string, string>;
      if (calls === 1) return 'not json';
      return JSON.stringify(Object.fromEntries(Object.entries(chunk).map(([k, v]) => [k, `JA:${v}`])));
    });
    const keys = Object.keys(SOURCE);
    expect(Object.keys(out).sort()).toEqual([...keys].sort());
    const translated = keys.filter((k) => out[k]!.startsWith('JA:')).length;
    expect(translated).toBeGreaterThan(keys.length * 0.8);
    expect(calls).toBe(Math.ceil(keys.length / 90));
  });

  it('brings an older cached pack up to date without an API key', () => {
    const keys = Object.keys(SOURCE);
    const [a, b, c] = keys;
    const withPlaceholder = keys.find((k) => SOURCE[k]!.includes('{{'))!;
    const { flat, missing } = mergeStale({ [a!]: `JA:${SOURCE[a!]}`, [b!]: SOURCE[b!], [withPlaceholder]: 'lost the placeholder', obsolete: 'x' });
    expect(Object.keys(flat).sort()).toEqual([...keys].sort());
    expect(flat[a!]).toBe(`JA:${SOURCE[a!]}`);
    expect(flat[b!]).toBe(SOURCE[b!]); // untranslated before → still English, and listed as missing
    expect(flat[withPlaceholder]).toBe(SOURCE[withPlaceholder]);
    expect(missing).toEqual(expect.arrayContaining([b!, c!, withPlaceholder]));
    expect(missing).not.toContain(a!);
    expect(flat).not.toHaveProperty('obsolete');
  });

  it('translates only the requested keys', async () => {
    const only = Object.keys(SOURCE).slice(0, 3);
    let calls = 0;
    const out = await translateAll('Japanese', async () => { calls += 1; return '{}'; }, only);
    expect(Object.keys(out)).toEqual(only);
    expect(calls).toBe(1);
  });

  it('finds English phrases left in a stored pack, ignoring names and codes', () => {
    const all = Object.fromEntries(Object.keys(SOURCE).map((k) => [k, `XX ${SOURCE[k]}`]));
    expect(untranslatedPhrases(all)).toEqual([]);
    const phraseKey = Object.keys(SOURCE).find((k) => /^[A-Z][a-z]+ [a-z]+/.test(SOURCE[k]!))!;
    expect(untranslatedPhrases({ ...all, [phraseKey]: SOURCE[phraseKey] })).toEqual([phraseKey]);
    const single = Object.keys(SOURCE).find((k) => /^[A-Za-z]+$/.test(SOURCE[k]!))!;
    expect(untranslatedPhrases({ ...all, [single]: SOURCE[single] })).toEqual([]);
  });

  it('gives up waiting after the deadline', async () => {
    expect(await withDeadline(new Promise(() => {}), 10)).toBeNull();
    expect(await withDeadline(Promise.resolve(1), 1000)).toBe(1);
    expect(await withDeadline(Promise.reject(new Error('x')), 1000)).toBeNull();
  });
});
