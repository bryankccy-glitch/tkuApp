import { describe, expect, it } from 'vitest';
import zh from '../locales/zh-TW';
import en from '../locales/en';

function flatten(o: object, prefix = ''): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) Object.assign(acc, flatten(v, key));
    else acc[key] = String(v);
    return acc;
  }, {});
}

describe('translations', () => {
  const z = flatten(zh);
  const e = flatten(en);
  it('Chinese and English have exactly the same keys', () => {
    expect(Object.keys(e).sort()).toEqual(Object.keys(z).sort());
  });
  it('every English string is filled and uses the same {{placeholders}}', () => {
    const ph = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).map((x) => x.replace(/\s/g, '')).sort();
    for (const k of Object.keys(z)) {
      const emptyOk = new Set(['course.periodSuffix']); // English has no counter word after “Periods 3–4”
      if (z[k] !== '' && !emptyOk.has(k)) expect(e[k], k).not.toBe('');
      expect(ph(e[k]!), k).toEqual(ph(z[k]!));
    }
  });
  it('English strings contain no Chinese characters (except intentional bilingual labels)', () => {
    // settings.zh: language name; csv.help & placeNote.T quote Chinese text the user must type or see
    // imageImport.*: the school page is only labelled in Chinese (查詢選課課表), so users must recognise that name.
    const allowed = new Set(['settings.zh', 'csv.help', 'placeNote.T', 'imageImport.description', 'imageImport.err.not_timetable']);
    const bad = Object.entries(e).filter(([k, v]) => !allowed.has(k) && /[一-鿿]/.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
