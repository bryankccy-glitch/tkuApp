import { normalizeImportCells } from './normalizeCells';
export { unifyTeachers } from './normalizeCells';
import type { ImportCell } from '@/lib/timetableImport';
import { cellLineImages, detectGrid, parseCellLines, type Grid, type LineImage, type Pixels } from './timetableGrid';

/**
 * Reads a TKU「查詢選課課表」screenshot entirely on the device with Tesseract.js (WASM).
 * No server, no API key: the engine and the Traditional Chinese model are served from /ocr/
 * (copied there by scripts/copy-ocr-assets.mjs) and cached after the first use.
 */

export class NotATimetableError extends Error {
  constructor() { super('not a timetable'); }
}

const MAX_SIDE = 4096;

async function toPixels(file: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: img.data };
}

/** Enlarge small glyphs once per memoized line; retain antialiasing for thin strokes. */
export function lineCanvas(l: LineImage, pad = 16): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = l.width;
  source.height = l.height;
  source.getContext('2d')!.putImageData(new ImageData(l.data, l.width, l.height), 0, 0);
  // cellLineImages adds three source pixels of padding, then scales the image.
  const sourceGlyphHeight = Math.max(1, l.bottom - l.top + 1);
  const glyphHeight = sourceGlyphHeight * l.height / (sourceGlyphHeight + 6);
  const scale = glyphHeight < 32 ? Math.min(4, 40 / glyphHeight) : 1;
  const width = Math.round(l.width * scale), height = Math.round(l.height * scale);
  const c = document.createElement('canvas');
  c.width = width + pad * 2;
  c.height = height + pad * 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, pad, pad, width, height);
  return c;
}

const NUMERALS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
/** "十二" → 12, "3" → 3. */
export function parsePeriodLabel(s: string): number | null {
  const t = s.replace(/\s/g, '');
  if (/^\d{1,2}$/.test(t)) return Number(t);
  if (!t || ![...t].every((c) => c in NUMERALS)) return null;
  if (t.length === 1) return NUMERALS[t]!;
  if (t[0] === '十') return 10 + (NUMERALS[t[1]!] ?? 0);
  return null;
}

/** Fix systematic slips of the TKU page font, e.g. the full-width dash in「體育－高爾夫」. */
export function tidyCourse(name: string): string {
  return name.replace(/體育[一ー_]/g, '體育－').replace(/\(([^()]*)\)/g, '（$1）');
}

export interface ReadProgress { done: number; total: number }

export async function readTimetableImage(file: Blob, onProgress?: (p: ReadProgress) => void): Promise<ImportCell[]> {
  const pixels = await toPixels(file);
  const grid: Grid | null = detectGrid(pixels);
  if (!grid) throw new NotATimetableError();

  // Collect the non-empty cells first, so progress has a known total.
  const jobs: { weekday: number; period: number; lines: LineImage[]; box: [number, number, number, number] }[] = [];
  for (let d = 1; d <= 7; d += 1) {
    for (let r = 1; r < grid.ys.length; r += 1) {
      const lines = cellLineImages(pixels, grid.xs[d]!, grid.ys[r - 1]!, grid.xs[d + 1]!, grid.ys[r]!);
      if (lines.length) jobs.push({ weekday: d, period: r, lines, box: [grid.xs[d]!, grid.ys[r - 1]!, grid.xs[d + 1]!, grid.ys[r]!] });
    }
  }
  if (!jobs.length) return [];
  const total = jobs.reduce((n, j) => n + j.lines.length, 0) + 1; // + reading the 節次 labels
  onProgress?.({ done: 0, total });

  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const worker = await createWorker('chi_tra', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    workerBlobURL: false,
    gzip: true,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    let done = 0;
    // The screenshot may start below period 1 (scrolled): check the 節次 labels of a few rows.
    // (一/二/三 are too thin to read reliably, so rows further down are used.)
    const offsets: number[] = [];
    for (let r = Math.min(4, grid.ys.length - 1); r < grid.ys.length && offsets.length < 3; r += 1) {
      const label = cellLineImages(pixels, grid.xs[0]!, grid.ys[r - 1]!, grid.xs[1]!, grid.ys[r]!);
      if (label.length !== 1) continue;
      const n = parsePeriodLabel((await worker.recognize(lineCanvas(label[0]!))).data.text);
      if (n && n >= r && n <= 14) offsets.push(n - r);
    }
    const first = 1 + (offsets.find((o, i) => offsets.indexOf(o) !== i) ?? (offsets.length === 1 ? offsets[0]! : 0));
    onProgress?.({ done: ++done, total });
    // Identical cells (a course over several periods) are rendered identically: read each once.
    // Pass 1: read every distinct line under several renderings.
    const readingsByKey = new Map<string, string[]>();
    const cellKeys: { job: (typeof jobs)[number]; keys: { key: string; link: boolean }[] }[] = [];
    for (const job of jobs) {
      let variants: LineImage[][] | null = null;
      const keys: { key: string; link: boolean }[] = [];
      for (const [i, l] of job.lines.entries()) {
        const key = `${l.width}x${l.height}:${hash(l.data)}`;
        keys.push({ key, link: l.link });
        if (!readingsByKey.has(key)) {
          const readings = [(await worker.recognize(lineCanvas(l))).data.text.trim()];
          variants ??= VOTE_VARIANTS.map(([scale, contrast]) => cellLineImages(pixels, ...job.box, scale, 0, contrast));
          for (const v of variants) {
            const alt = v.length === job.lines.length ? v[i] : undefined;
            if (alt) readings.push((await worker.recognize(lineCanvas(alt))).data.text.trim());
          }
          readingsByKey.set(key, readings);
        }
        onProgress?.({ done: ++done, total });
      }
      cellKeys.push({ job, keys });
    }
    // Pass 2: vote. Ties are broken by how often each character is read anywhere in this screenshot,
    // so a name read clearly in one cell (鄭培宇) settles a split reading of it in another.
    const prior = new Map<string, number>();
    for (const readings of readingsByKey.values()) {
      const clean = readings.map((r) => r.replace(/\s+/g, '')).filter(Boolean);
      const agreed = clean.find((r) => clean.filter((x) => x === r).length * 2 > clean.length);
      // Only lines the renderings agree on count as evidence of how this page spells things.
      if (agreed) for (const ch of agreed) prior.set(ch, (prior.get(ch) ?? 0) + 1);
    }
    const voted = new Map([...readingsByKey].map(([key, readings]) => [key, voteReadings(readings, prior)]));
    const cells: ImportCell[] = [];
    for (const { job, keys } of cellKeys) {
      const texts = keys.map(({ key, link }) => ({ text: voted.get(key)!, link }));
      const parsed = parseCellLines(texts);
      const period = job.period + first - 1;
      if (!parsed || period > 14) continue;
      cells.push({ weekday: job.weekday, period, group: parsed.group.replace(/\s/g, ''), course: tidyCourse(parsed.course), teacher: parsed.teacher, room: parsed.room });
    }
    return normalizeImportCells(cells);
  } finally {
    await worker.terminate();
  }
}

/** Alternative renderings (upscale factor, contrast) used only for voting; the default render is 3×, 1.0. */
const VOTE_VARIANTS: [number, number][] = [[2, 1], [3, 1.6], [4, 1], [2, 2]];

/**
 * Majority vote over several OCR readings of the same line. A reading shared by most renderings
 * wins; otherwise readings of the most common length are voted per character. Never invents
 * characters that no rendering produced.
 */
export function voteReadings(readings: string[], prior?: ReadonlyMap<string, number>): string {
  // Renderings disagree on spaces (「B607」/「B 607」) far more than on characters: vote without them.
  const list = readings.map((r) => r.replace(/\s+/g, '')).filter(Boolean);
  if (!list.length) return readings[0] ?? '';
  const counts = new Map<string, number>();
  for (const r of list) counts.set(r, (counts.get(r) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
  if (n > list.length / 2) return top;
  const lengths = new Map<number, number>();
  for (const r of list) lengths.set([...r].length, (lengths.get([...r].length) ?? 0) + 1);
  const len = [...lengths].sort((a, b) => b[1] - a[1] || (a[0] === [...list[0]!].length ? -1 : 1))[0]![0];
  const same = list.filter((r) => [...r].length === len).map((r) => [...r]);
  if (same.length < 2) return list[0]!;
  return Array.from({ length: len }, (_, i) => {
    const c = new Map<string, number>();
    for (const r of same) c.set(r[i]!, (c.get(r[i]!) ?? 0) + 1);
    const best = Math.max(...c.values());
    const order = same.map((r) => r[i]!).filter((ch, k, all) => all.indexOf(ch) === k);
    if (best * 2 > same.length) return order.find((ch) => c.get(ch) === best)!;
    // No majority for this character: prefer the candidate this page spells confidently elsewhere,
    // then the more frequent one, then the default rendering's. Only characters actually read qualify.
    return order.sort((a, b) => ((prior?.get(b) ?? 0) > 0 ? 1 : 0) - ((prior?.get(a) ?? 0) > 0 ? 1 : 0) || c.get(b)! - c.get(a)!)[0]!;
  }).join('');
}

function hash(data: Uint8ClampedArray): number {
  let h = 2166136261;
  for (let i = 0; i < data.length; i += 4) h = Math.imul(h ^ data[i]!, 16777619);
  return h >>> 0;
}
