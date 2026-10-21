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

function lineCanvas(l: LineImage, pad = 16): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = l.width + pad * 2;
  c.height = l.height + pad * 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.putImageData(new ImageData(l.data, l.width, l.height), pad, pad);
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
  const jobs: { weekday: number; period: number; lines: LineImage[] }[] = [];
  for (let d = 1; d <= 7; d += 1) {
    for (let r = 1; r < grid.ys.length; r += 1) {
      const lines = cellLineImages(pixels, grid.xs[d]!, grid.ys[r - 1]!, grid.xs[d + 1]!, grid.ys[r]!);
      if (lines.length) jobs.push({ weekday: d, period: r, lines });
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
    const memo = new Map<string, string>();
    const cells: ImportCell[] = [];
    for (const job of jobs) {
      const texts: { text: string; link: boolean }[] = [];
      for (const l of job.lines) {
        const key = `${l.width}x${l.height}:${hash(l.data)}`;
        let text = memo.get(key);
        if (text === undefined) {
          text = (await worker.recognize(lineCanvas(l))).data.text.trim();
          memo.set(key, text);
        }
        texts.push({ text, link: l.link });
        onProgress?.({ done: ++done, total });
      }
      const parsed = parseCellLines(texts);
      const period = job.period + first - 1;
      if (!parsed || period > 14) continue;
      cells.push({ weekday: job.weekday, period, group: parsed.group.replace(/\s/g, ''), course: tidyCourse(parsed.course), teacher: parsed.teacher, room: parsed.room });
    }
    return unifyTeachers(cells);
  } finally {
    await worker.terminate();
  }
}

const oneCharApart = (a: string, b: string) =>
  a.length === b.length && a.length >= 2 && [...a].filter((c, i) => c !== b[i]).length === 1;

/**
 * The same instructor of the same course can be read with one character different in another
 * cell (e.g. 鄭元成 / 笨元成), which would split one course in two. Use the more frequent reading.
 */
export function unifyTeachers(cells: ImportCell[]): ImportCell[] {
  const byCourse = new Map<string, Map<string, number>>();
  for (const c of cells) {
    const m = byCourse.get(c.course) ?? new Map<string, number>();
    m.set(c.teacher, (m.get(c.teacher) ?? 0) + 1);
    byCourse.set(c.course, m);
  }
  return cells.map((c) => {
    const counts = byCourse.get(c.course)!;
    let best = c.teacher;
    for (const [name, n] of counts) {
      if (name !== c.teacher && oneCharApart(name, c.teacher) && n > (counts.get(best) ?? 0)) best = name;
    }
    return best === c.teacher ? c : { ...c, teacher: best };
  });
}

function hash(data: Uint8ClampedArray): number {
  let h = 2166136261;
  for (let i = 0; i < data.length; i += 4) h = Math.imul(h ^ data[i]!, 16777619);
  return h >>> 0;
}
