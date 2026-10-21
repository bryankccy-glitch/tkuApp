import { describe, expect, it } from 'vitest';
import { detectGrid, cellLineImages, normalizeRoom, parseCellLines } from '../timetableGrid';
import { parsePeriodLabel, tidyCourse } from '../readTimetable';

/** A synthetic page: white, a header row, then a 9-rule × 15-rule grid like 查詢選課課表. */
function page(opts: { cellW?: number; cellH?: number; noise?: boolean } = {}) {
  const cellW = opts.cellW ?? 120, cellH = opts.cellH ?? 70, labelW = 50;
  const x0 = 30, y0 = 300;
  const xs = [x0, x0 + labelW, ...Array.from({ length: 7 }, (_, i) => x0 + labelW + (i + 1) * cellW)];
  const ys = Array.from({ length: 15 }, (_, i) => y0 + i * cellH);
  const width = xs[8]! + 30, height = ys[14]! + 400;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const dot = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * width + x) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
  };
  const grey: [number, number, number] = [170, 170, 170];
  for (const y of [y0 - 80, ...ys]) for (let x = xs[0]!; x <= xs[8]!; x += 1) { dot(x, y, grey); dot(x, y + 1, grey); }
  for (const x of xs) for (let y = y0 - 80; y <= ys[14]!; y += 1) { dot(x, y, grey); dot(x + 1, y, grey); }
  if (opts.noise) {
    // Evenly spaced full-width rules below the table (another list on the page) must not be taken for it.
    for (let k = 0; k < 12; k += 1) for (let x = 0; x < width; x += 1) dot(x, ys[14]! + 30 + k * 28, grey);
  }
  // A "course" in Wed period 3: black text block, then a blue underlined link line, then text.
  const cx = xs[3]! + 4, cy = ys[2]! + 8;
  for (let y = 0; y < 12; y += 1) for (let x = 0; x < 40; x += 1) if ((x + y) % 3) dot(cx + x, cy + y, [0, 0, 0]);
  for (let y = 0; y < 12; y += 1) for (let x = 0; x < 70; x += 1) if ((x + y) % 3) dot(cx + x, cy + 20 + y, [0, 0, 238]);
  for (let x = 0; x < 70; x += 1) dot(cx + x, cy + 33, [0, 0, 238]);
  for (let y = 0; y < 12; y += 1) for (let x = 0; x < 60; x += 1) if ((x + 2 * y) % 3) dot(cx + x, cy + 40 + y, [0, 0, 0]);
  return { p: { width, height, data }, xs, ys };
}

describe('detectGrid', () => {
  it('finds the 9 vertical and 15 horizontal rules of the timetable', () => {
    const { p, xs, ys } = page();
    const g = detectGrid(p)!;
    expect(g).not.toBeNull();
    g.xs.forEach((x, i) => expect(Math.abs(x - xs[i]!)).toBeLessThanOrEqual(1));
    expect(g.ys).toHaveLength(15);
    g.ys.forEach((y, i) => expect(Math.abs(y - ys[i]!)).toBeLessThanOrEqual(1));
  });

  it('ignores other evenly spaced lines on the page', () => {
    const { p, ys } = page({ noise: true });
    expect(detectGrid(p)!.ys[0]).toBeCloseTo(ys[0]!, -1);
  });

  it('returns null for an image without a timetable', () => {
    const width = 300, height = 600;
    expect(detectGrid({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) })).toBeNull();
  });
});

describe('cellLineImages', () => {
  it('splits a cell into its text lines, marks the blue link line and drops the underline', () => {
    const { p } = page();
    const g = detectGrid(p)!;
    const lines = cellLineImages(p, g.xs[3]!, g.ys[2]!, g.xs[4]!, g.ys[3]!);
    expect(lines.map((l) => l.link)).toEqual([false, true, false]);
    expect(lines.every((l) => l.width > 0 && l.data.length === l.width * l.height * 4)).toBe(true);
    // Underline removed: the link line is no taller than its glyph rows (+ padding).
    expect(lines[1]!.bottom - lines[1]!.top).toBeLessThan(16);
    expect(cellLineImages(p, g.xs[1]!, g.ys[0]!, g.xs[2]!, g.ys[1]!)).toEqual([]);
  });
});

describe('parseCellLines', () => {
  it('uses the blue link lines as the course name', () => {
    expect(parseCellLines([
      { text: '資 管 二' }, { text: '網 路 與 通訊', link: true }, { text: '鄭 培 宇 B217' },
    ])).toEqual({ group: '資 管 二', course: '網路與通訊', teacher: '鄭培宇', room: 'B217' });
    expect(parseCellLines([
      { text: '男 、 女 生 體育 一 高 爾 夫', link: true }, { text: '球 興趣 班', link: true }, { text: '蕭 淑 芬' },
    ])).toEqual({ group: '', course: '男、女生體育一高爾夫球興趣班', teacher: '蕭淑芬', room: '' });
  });

  it('recognises 助教 even when its first character is misread, and fixes room digits', () => {
    expect(parseCellLines([{ text: '資管二' }, { text: '經濟學', link: true }, { text: '站 教 B1l8' }]))
      .toMatchObject({ teacher: '助教', room: 'B118' });
  });

  it('falls back to line order without colour information', () => {
    expect(parseCellLines(['共同科', '英文（二）', '李金安_SG 314'])).toEqual({ group: '共同科', course: '英文（二）', teacher: '李金安', room: 'SG314' });
    expect(parseCellLines([])).toBeNull();
  });
});

describe('helpers', () => {
  it('normalizeRoom', () => {
    expect(normalizeRoom('B 2l7')).toBe('B217');
    expect(normalizeRoom('sg 3I4')).toBe('SG314');
    expect(normalizeRoom('T 7O1')).toBe('T701');
  });
  it('parsePeriodLabel', () => {
    expect(parsePeriodLabel('四')).toBe(4);
    expect(parsePeriodLabel('十 二')).toBe(12);
    expect(parsePeriodLabel('7')).toBe(7);
    expect(parsePeriodLabel('石')).toBeNull();
  });
  it('tidyCourse', () => {
    expect(tidyCourse('男、女生體育一高爾夫球興趣班')).toBe('男、女生體育－高爾夫球興趣班');
    expect(tidyCourse('英文(二)')).toBe('英文（二）');
  });
});

describe('unifyTeachers', () => {
  it('merges one-character misreadings of the same instructor within a course', async () => {
    const { unifyTeachers } = await import('../readTimetable');
    const c = (period: number, teacher: string, course = '程式設計與資料結構') => ({ weekday: 4, period, group: '資管二', course, teacher, room: 'B130' });
    const out = unifyTeachers([c(8, '笨元成'), c(3, '鄭元成'), c(4, '鄭元成'), c(1, '助教'), c(2, '陳紹良', '經濟學')]);
    expect(out.map((x) => x.teacher)).toEqual(['鄭元成', '鄭元成', '鄭元成', '助教', '陳紹良']);
  });
});
