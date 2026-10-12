import type { Ctx } from './pixel';
import { rng } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css } from './palettes';

interface CloudShape {
  w: number;
  h: number;
  /** rows of [start, end) spans */
  rows: [number, number][];
}

/** Puffy pixel clouds built from overlapping discs with a flat base. */
function makeShape(seed: number, big: boolean): CloudShape {
  const r = rng(seed);
  const puffs = (big ? 4 : 3) + Math.floor(r() * 2);
  const discs: { x: number; y: number; r: number }[] = [];
  let x = 0;
  for (let i = 0; i < puffs; i++) {
    const rad = (big ? 4 : 3) + Math.floor(r() * (big ? 4 : 3));
    discs.push({ x: x + rad, y: 0, r: rad });
    x += rad + Math.floor(r() * 3);
  }
  const w = x + (discs[discs.length - 1]?.r ?? 3) + 2;
  const maxR = Math.max(...discs.map((d) => d.r));
  const h = maxR + 1;
  const rows: [number, number][] = [];
  // Each puff is the upper half of a disc resting on a flat base (row h-1).
  for (let y = 0; y < h; y++) {
    const up = h - 1 - y;
    let s = Infinity, e = -Infinity;
    for (const d of discs) {
      const rr = d.r * d.r + d.r * 0.5 - up * up;
      if (rr < 0) continue;
      const half = Math.floor(Math.sqrt(rr));
      s = Math.min(s, d.x - half);
      e = Math.max(e, d.x + half + 1);
    }
    rows.push(Number.isFinite(s) ? [Math.max(0, s), Math.min(w, e)] : [0, 0]);
  }
  return { w, h, rows };
}

const SHAPES = Array.from({ length: 8 }, (_, i) => makeShape(100 + i * 13, i % 3 !== 2));

export interface CloudPlan {
  shape: CloudShape;
  y: number;
  speed: number; // art px / second
  offset: number;
}

export function planClouds(L: Layout, s: SceneState): CloudPlan[] {
  const r = rng(41);
  const n = 2 + Math.round(s.cloudCover * 7);
  const drift = 0.8 + Math.min(30, s.windSpeed) / 10;
  return Array.from({ length: n }, (_, i) => ({
    shape: SHAPES[i % SHAPES.length]!,
    y: Math.round(L.H * 0.05 + r() * L.H * (s.weather === 'sunny' ? 0.28 : 0.36)),
    speed: drift * (0.6 + r() * 0.8) * (i % 2 ? 0.8 : 1),
    offset: r() * (L.W + 60),
  }));
}

export function drawClouds(ctx: Ctx, L: Layout, p: Palette, plans: CloudPlan[], time: number) {
  for (const c of plans) {
    const span = L.W + c.shape.w + 20;
    const x = Math.round(((c.offset + (time / 1000) * c.speed) % span) - c.shape.w - 10);
    c.shape.rows.forEach(([a, b], row) => {
      if (b <= a) return;
      const shade = row >= c.shape.h - 2;
      ctx.fillStyle = css(shade ? p.cloudShade : p.cloudLight);
      ctx.fillRect(x + a, c.y + row, b - a, 1);
    });
  }
}

/** Soft moving cloud shadows on the water when overcast. */
export function drawCloudShadows(ctx: Ctx, L: Layout, p: Palette, plans: CloudPlan[], s: SceneState, time: number) {
  if (s.weather === 'sunny' || s.phase === 'night') return;
  for (const c of plans) {
    const span = L.W + c.shape.w + 20;
    const x = Math.round(((c.offset + (time / 1000) * c.speed) % span) - c.shape.w - 10);
    ctx.fillStyle = css(p.riverDeep, 0.22);
    ctx.fillRect(x, L.horizon + 2 + (c.y % 7), c.shape.w, 2 + (c.y % 3));
  }
}
