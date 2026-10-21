import { describe, expect, it } from 'vitest';
import { SOURCE, VERSION, acceptTranslation, flatten, translateAll, unflatten } from '../translate.js';

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
});
