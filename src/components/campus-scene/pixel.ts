import type { RGB } from './sceneTypes';
import { css } from './palettes';

export type Ctx = CanvasRenderingContext2D;

/** Deterministic PRNG so the scene layout is stable between frames and sessions. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: RGB, a = 1) {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function dot(ctx: Ctx, x: number, y: number, c: RGB, a = 1) {
  rect(ctx, x, y, 1, 1, c, a);
}

/** Bresenham line, 1 art-pixel wide. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1) {
  ctx.fillStyle = css(c, a);
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Filled pixel disc (no anti-aliasing). */
export function disc(ctx: Ctx, cx: number, cy: number, r: number, c: RGB, a = 1) {
  ctx.fillStyle = css(c, a);
  const rr = r * r + r * 0.6;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, rr - y * y)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

/** Vertical gradient with ordered dithering between quantised bands — the classic 16-bit sky. */
export function ditherGradient(img: ImageData, x0: number, y0: number, w: number, h: number, stops: RGB[], bands = 7) {
  const W = img.width;
  const levels: RGB[] = [];
  for (let i = 0; i <= bands; i++) levels.push(sample(stops, i / bands));
  for (let y = 0; y < h; y++) {
    const f = (y / Math.max(1, h - 1)) * bands;
    const lo = Math.min(bands, Math.floor(f));
    const frac = f - lo;
    for (let x = 0; x < w; x++) {
      const c = frac > BAYER4[(y0 + y) & 3]![(x0 + x) & 3]! ? levels[Math.min(bands, lo + 1)]! : levels[lo]!;
      const i = ((y0 + y) * W + (x0 + x)) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
}

function sample(stops: RGB[], t: number): RGB {
  const seg = (stops.length - 1) * t;
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = stops[i]!, b = stops[i + 1]!;
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

/** Checkerboard-dithered translucent band (pixel-art transparency). */
export function ditherFill(ctx: Ctx, x: number, y: number, w: number, h: number, c: RGB, density: number) {
  ctx.fillStyle = css(c);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (density > BAYER4[(y + yy) & 3]![(x + xx) & 3]!) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}
