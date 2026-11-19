import type { ImportCell } from '../timetableImport';

export const courseKey = (name: string): string => name.normalize('NFKC').replace(/\s/g, '').toLowerCase();
export const isTa = (teacher: string): boolean => /^(助教|ta)$/i.test(teacher.normalize('NFKC').replace(/\s/g, ''));

/** Only choose observed, nonempty readings. Map order preserves the first occurrence. */
export function mostFrequent(values: string[], preferLongest = false): string {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = '', count = 0;
  for (const [value, n] of counts) {
    if (n > count || (n === count && preferLongest && value.length > best.length)) {
      best = value;
      count = n;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(next[j - 1]! + 1, row[j]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length]!;
}

/** 「微積分（一）／（二）」「英文上／下」are different courses: never merge names that differ in an ordinal. */
const ORDINALS = new Set([...'一二三四五六七八九十上下甲乙丙ABCDⅠⅡⅢⅣ1234567890abcd']);
export function differsOnlyByOrdinal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diff = [...a].map((ch, i) => [ch, [...b][i]!] as const).filter(([x, y]) => x !== y);
  return diff.length > 0 && diff.some(([x, y]) => ORDINALS.has(x) || ORDINALS.has(y));
}

/** Rank observed names by frequency; match directly to a winner to avoid transitive chains. */
export function unifyCourseNames(cells: ImportCell[]): ImportCell[] {
  const readings = new Map<string, string[]>();
  for (const c of cells) {
    const key = courseKey(c.course);
    if (key) readings.set(key, [...(readings.get(key) ?? []), c.course]);
  }
  const ranked = [...readings].sort((a, b) => b[1].length - a[1].length);
  const winners: string[] = [];
  const canonical = new Map<string, string>();
  for (const [key, names] of ranked) {
    const winner = winners.find((other) => {
      const limit = Math.max(1, Math.floor(Math.max(key.length, other.length) * 0.2));
      return Math.min(key.length, other.length) >= 2 && !differsOnlyByOrdinal(key, other)
        && Math.abs(key.length - other.length) <= limit && editDistance(key, other) <= limit;
    });
    if (winner) canonical.set(key, canonical.get(winner)!);
    else {
      winners.push(key);
      canonical.set(key, mostFrequent(names));
    }
  }
  return cells.map((c) => ({ ...c, course: canonical.get(courseKey(c.course)) ?? c.course }));
}

/** A course has one lecturer reading, regardless of OCR edit distance; TA stays separate. */
export function unifyTeachers(cells: ImportCell[]): ImportCell[] {
  const byCourse = new Map<string, string[]>();
  for (const c of cells) {
    if (isTa(c.teacher)) continue;
    const key = courseKey(c.course);
    byCourse.set(key, [...(byCourse.get(key) ?? []), c.teacher.trim()]);
  }
  const teachers = new Map([...byCourse].map(([key, names]) => [key, mostFrequent(names, true)]));
  return cells.map((c) => ({ ...c, teacher: isTa(c.teacher) ? '助教' : teachers.get(courseKey(c.course)) ?? '' }));
}

export function normalizeImportCells(cells: ImportCell[]): ImportCell[] {
  return unifyTeachers(unifyCourseNames(cells));
}
