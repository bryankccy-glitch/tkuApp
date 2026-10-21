/**
 * On-device reading of a TKU「查詢選課課表」screenshot — no server, no API key.
 * 1. Find the timetable grid from its ruled lines (8 columns: 節次 + 一…日, 14 period rows).
 * 2. For every non-empty cell, split it into text lines and prepare each line as a clean,
 *    enlarged black-on-white image (blue link colour and underlines removed).
 * 3. The caller OCRs the lines (Tesseract.js) and `parseCellLines` turns them into
 *    group / course / teacher / room, with fixes for common OCR slips.
 * Pure functions on RGBA pixel data, so the same code runs in the browser and in tests.
 */

export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export interface Grid { xs: number[]; ys: number[] }
/** One text line of a cell. `link`: drawn in the page's blue link colour (= the course name). */
export interface LineImage { width: number; height: number; data: Uint8ClampedArray; link: boolean; top: number; bottom: number }

const lum = (p: Pixels, x: number, y: number) => {
  const i = (y * p.width + x) * 4;
  return (p.data[i]! * 299 + p.data[i + 1]! * 587 + p.data[i + 2]! * 114) / 1000;
};

function runs(values: number[]): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= values.length; i += 1) {
    const on = i < values.length && values[i] === 1;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { out.push([s, i - 1]); s = -1; }
  }
  return out;
}
const mid = ([a, b]: [number, number]) => Math.round((a + b) / 2);

/**
 * Finds the timetable grid: x of 9 vertical rules (節次 + 7 days) and y of up to 15 period rules.
 * Returns null when no such table is found (not a TKU timetable screenshot).
 */
export function detectGrid(p: Pixels): Grid | null {
  const { width: W, height: H } = p;
  const dark = (x: number, y: number) => lum(p, x, y) < 215;
  // Horizontal rules: rows that are mostly non-white.
  const rowFlags = Array.from({ length: H }, (_, y) => {
    let c = 0;
    for (let x = 0; x < W; x += 1) if (dark(x, y)) c += 1;
    return c > W * 0.45 ? 1 : 0;
  });
  const hLines = runs(rowFlags).map(mid);
  // Chains of evenly spaced rules; the timetable is the one that also has ≥ 9 full-height vertical rules.
  const chains: number[][] = [];
  for (let i = 0; i < hLines.length; i += 1) {
    for (let j = i + 1; j < hLines.length; j += 1) {
      const ref = hLines[j]! - hLines[i]!;
      if (ref < 20) continue;
      if (ref > H / 6) break;
      const seq = [hLines[i]!, hLines[j]!];
      const tol = Math.max(3, ref * 0.08);
      for (let k = j + 1; k < hLines.length; k += 1) {
        const gap = hLines[k]! - seq[seq.length - 1]!;
        if (Math.abs(gap - ref) <= tol) seq.push(hLines[k]!);
        else if (gap > ref + tol) break;
      }
      if (seq.length >= 11) chains.push(seq);
    }
  }
  chains.sort((a, b) => b.length - a.length);
  for (const chain of chains) {
    const xs = verticalRules(p, chain[0]!, chain[Math.min(chain.length, 15) - 1]!);
    if (xs) return { xs, ys: chain.slice(0, 15) };
  }
  return null;
}

function verticalRules(p: Pixels, top: number, bottom: number): number[] | null {
  const W = p.width;
  const colFlags = Array.from({ length: W }, (_, x) => {
    let c = 0;
    for (let y = top; y <= bottom; y += 1) if (lum(p, x, y) < 215) c += 1;
    return c > (bottom - top) * 0.85 ? 1 : 0;
  });
  const vLines = runs(colFlags).map(mid);
  if (vLines.length < 9) return null;
  // 9 rules: 節次 column + 7 evenly wide day columns.
  let xs: number[] | null = null;
  let bestScore = Infinity;
  for (let s = 0; s + 9 <= vLines.length; s += 1) {
    const cand = vLines.slice(s, s + 9);
    const gaps = cand.slice(2).map((x, k) => x - cand[k + 1]!);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const score = gaps.reduce((a, g) => a + Math.abs(g - avg), 0);
    if (avg > 20 && score < bestScore && score < avg * 0.6) { bestScore = score; xs = cand; }
  }
  return xs;

}

/** Text lines of one cell as clean binary images, scaled up for OCR. Empty cell → []. */
export function cellLineImages(p: Pixels, x0: number, y0: number, x1: number, y1: number, scale = 3, threshold = 0, contrast = 1.0): LineImage[] {
  // Skip the ruled lines themselves (text starts right after the left rule).
  const isRuleCol = (x: number) => { let c = 0; for (let y = y0 + 3; y < y1 - 3; y += 1) if (lum(p, x, y) < 215) c += 1; return c > (y1 - y0 - 6) * 0.85; };
  const isRuleRow = (y: number) => { let c = 0; for (let x = x0 + 3; x < x1 - 3; x += 1) if (lum(p, x, y) < 215) c += 1; return c > (x1 - x0 - 6) * 0.85; };
  let lx = x0, rx = x1, ty = y0, by = y1;
  while (lx < x1 && isRuleCol(lx)) lx += 1;
  while (rx > lx && isRuleCol(rx)) rx -= 1;
  while (ty < y1 && isRuleRow(ty)) ty += 1;
  while (by > ty && isRuleRow(by)) by -= 1;
  const left = lx, top = ty, w = Math.max(0, rx - lx + 1), h = Math.max(0, by - ty + 1);
  if (w < 10 || h < 10) return [];
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) ink[y * w + x] = lum(p, left + x, top + y) < 190 ? 1 : 0;
  const rowInk = Array.from({ length: h }, (_, y) => { let c = 0; for (let x = 0; x < w; x += 1) c += ink[y * w + x]!; return c; });
  const bands = runs(rowInk.map((c) => (c > 0 ? 1 : 0))).filter(([a, b]) => b - a >= 4);
  const out: LineImage[] = [];
  for (const [a, b] of bands) {
    // Underline rows: almost solid across the text's width.
    let minX = w, maxX = 0;
    for (let y = a; y <= b; y += 1) for (let x = 0; x < w; x += 1) if (ink[y * w + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const textW = Math.max(1, maxX - minX + 1);
    // Underline: a row (and its anti-aliased neighbours) inked across almost the whole text width.
    const faint = (y: number) => { let c = 0; for (let x = minX; x <= maxX; x += 1) if (lum(p, left + x, top + y) < 245) c += 1; return c; };
    const under = new Set<number>();
    for (let y = Math.round(a + (b - a) * 0.6); y <= b; y += 1) {
      if (faint(y) > textW * 0.9) under.add(y);
    }
    const keep = (y: number) => !under.has(y);
    let inkN = 0, blueN = 0;
    for (let y = a; y <= b; y += 1) for (let x = 0; x < w; x += 1) {
      if (!ink[y * w + x]) continue;
      inkN += 1;
      const i = ((top + y) * p.width + left + x) * 4;
      if (p.data[i + 2]! - p.data[i]! > 60) blueN += 1;
    }
    const pad = 3;
    const bw = w + pad * 2, bh = b - a + 1 + pad * 2;
    const W2 = bw * scale, H2 = bh * scale;
    const data = new Uint8ClampedArray(W2 * H2 * 4).fill(255);
    // Smooth upscale of the cell's luminance, then threshold → crisp black glyphs.
    for (let Y = 0; Y < H2; Y += 1) {
      const sy = Y / scale - pad + a - 0.5;
      const yi = Math.floor(sy), fy = sy - yi;
      for (let X = 0; X < W2; X += 1) {
        const sx = X / scale - pad - 0.5;
        const xi = Math.floor(sx), fx = sx - xi;
        let v = 0;
        for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
          const xx = xi + dx, yy = yi + dy;
          const inside = xx >= 0 && xx < w && yy >= a && yy <= b && keep(yy);
          v += wgt * (inside ? 255 - lum(p, left + xx, top + yy) : 0);
        }
        const o = (Y * W2 + X) * 4;
        const g = threshold > 0 ? (v > threshold ? 0 : 255) : 255 - Math.min(255, v * contrast);
        data[o] = data[o + 1] = data[o + 2] = g;
      }
    }
    out.push({ width: W2, height: H2, data, link: blueN > inkN * 0.4, top: top + a, bottom: top + b });
  }
  return out;
}

export interface ParsedCell { group: string; course: string; teacher: string; room: string }

const ROOM_FIX: Record<string, string> = { l: '1', I: '1', i: '1', '|': '1', O: '0', o: '0', S: '5', Z: '2', z: '2' };

/** "B1l8" → "B118", "SG 3l4" → "SG314". Building letters stay letters, digits become digits. */
export function normalizeRoom(raw: string): string {
  const s = raw.replace(/\s+/g, '').replace(/[＿_]/g, '');
  const m = s.match(/^([A-Za-z]{1,2})(.*)$/);
  if (!m) return s;
  const digits = m[2]!.split('').map((c) => ROOM_FIX[c] ?? c).join('').replace(/[^0-9A-Z]/g, '');
  return `${m[1]!.toUpperCase()}${digits}`;
}

export interface CellLine { text: string; link?: boolean }

const ROOM_AT_END = /^(.*?)[\s_＿]*([A-Za-z]{1,2}\s*[0-9lIiOoSZz|]{2,4}[A-Za-z]?)\s*$/;

/** "助 教" (TA) is often misread as two random characters ending in 教. */
const cleanTeacher = (name: string) => {
  const n = name.replace(/[_＿\s|]/g, '');
  return /^.?教$/.test(n) || /助教/.test(n) ? '助教' : n;
};

/**
 * Lines of one cell → fields. Layout on the page: [開課班級] / 課名 (blue link, may wrap) / 教師_教室.
 * With colour info the course is exactly the blue lines; without it, the last line is the
 * teacher/room line when it has "_" or ends in a room code.
 */
export function parseCellLines(input: (string | CellLine)[]): ParsedCell | null {
  const ls = input.map((l) => (typeof l === 'string' ? { text: l } : l))
    .map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), link: l.link }))
    .filter((l) => l.text);
  if (!ls.length) return null;
  const firstLink = ls.findIndex((l) => l.link);
  if (firstLink >= 0) {
    let lastLink = firstLink;
    while (ls[lastLink + 1]?.link) lastLink += 1;
    const course = ls.slice(firstLink, lastLink + 1).map((l) => l.text).join('').replace(/\s/g, '');
    const group = ls.slice(0, firstLink).map((l) => l.text).join('');
    const tail = ls.slice(lastLink + 1).map((l) => l.text).join(' ');
    const m = tail.match(ROOM_AT_END);
    return {
      group,
      course,
      teacher: cleanTeacher(m ? m[1]! : tail.split(/[_＿]/)[0] ?? ''),
      room: m ? normalizeRoom(m[2]!) : '',
    };
  }
  let teacher = '', room = '';
  const lines = ls.map((l) => l.text);
  const last = lines[lines.length - 1]!;
  const tr = last.match(ROOM_AT_END);
  if (tr || /[_＿]/.test(last)) {
    lines.pop();
    teacher = cleanTeacher(tr ? tr[1]! : last.split(/[_＿]/)[0]!);
    room = tr ? normalizeRoom(tr[2]!) : '';
  }
  const group = lines.length >= 2 ? lines[0]! : '';
  const course = (lines.length >= 2 ? lines.slice(1) : lines).join('').replace(/\s/g, '');
  if (!course) return null;
  return { group, course, teacher, room };
}
