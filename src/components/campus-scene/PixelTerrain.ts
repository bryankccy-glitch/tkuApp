import type { Ctx } from './pixel';
import { BAYER4, disc, rect, rng } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css } from './palettes';

/** y of the campus hill (五虎崗) edge at column x. */
function hillY(L: Layout, x: number) {
  const fx = x / L.W;
  const base = L.hillLeft + (L.hillRight - L.hillLeft) * fx;
  const bump = fx > 0.72 ? Math.sin(((fx - 0.72) / 0.28) * Math.PI * 0.5) * L.H * 0.06 : 0;
  return Math.round(base - bump + Math.sin(x * 0.35) * 0.6);
}

/** Static foreground: grassy campus slope with a 宮燈教室-style pavilion on the right. */
export function drawTerrain(ctx: Ctx, L: Layout, p: Palette, s: SceneState) {
  for (let x = 0; x < L.W; x++) {
    const top = hillY(L, x);
    rect(ctx, x, top, 1, 2, p.grassLight);
    for (let y = top + 2; y < L.H; y++) {
      const shade = 0.25 + ((y - top) / (L.H - top)) * 0.5 > BAYER4[y & 3]![x & 3]!;
      ctx.fillStyle = css(shade ? p.grassDark : p.grassLight);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // grass tufts
  const r = rng(9);
  ctx.fillStyle = css(p.grassLight);
  for (let i = 0; i < L.W / 6; i++) {
    const x = Math.floor(r() * L.W);
    ctx.fillRect(x, hillY(L, x) - 1, 1, 1);
  }

  // Pavilion inspired by 宮燈教室: white wall, red columns, upturned red roof
  const px = Math.round(L.W * 0.83), pw = Math.max(18, Math.round(L.W * 0.13));
  const base = hillY(L, px + pw / 2);
  const wallH = Math.round(L.H * 0.045);
  const wallTop = base - wallH;
  rect(ctx, px, wallTop, pw, wallH, p.wall);
  for (let x = px + 1; x < px + pw - 1; x += 4) rect(ctx, x, wallTop, 1, wallH, p.roofRed); // columns
  if (s.lights > 0.2) for (let x = px + 3; x < px + pw - 2; x += 4) rect(ctx, x, wallTop + 2, 1, 1, p.windowLit, Math.min(1, s.lights + 0.2));
  // roof: eave line with upturned ends, then two tiers
  rect(ctx, px - 2, wallTop - 1, pw + 4, 1, p.roofRed);
  rect(ctx, px - 3, wallTop - 2, 1, 1, p.roofRed);
  rect(ctx, px + pw + 2, wallTop - 2, 1, 1, p.roofRed);
  rect(ctx, px, wallTop - 2, pw, 1, p.roofRed);
  rect(ctx, px + 2, wallTop - 3, pw - 4, 1, p.roofRed);
  rect(ctx, px + 4, wallTop - 4, pw - 8, 1, p.roofRed);
}

const TREES = [0.06, 0.16, 0.27, 0.62, 0.74];

/** Trees sway one pixel (animated). */
export function drawTrees(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  const windy = s.windSpeed > 18 || s.weather === 'rainy';
  TREES.forEach((fx, i) => {
    const x = Math.round(L.W * fx);
    const ground = hillY(L, x);
    const size = 3 + (i % 3);
    const trunkH = size + 1;
    rect(ctx, x, ground - trunkH, 1, trunkH, p.trunk);
    const sway = Math.round(Math.sin(time / (windy ? 450 : 1100) + i * 1.7) * (windy ? 1 : 0.6));
    const cy = ground - trunkH - size + 1;
    disc(ctx, x + sway, cy, size, p.treeDark);
    disc(ctx, x - 1 + sway, cy - 1, size - 1, p.treeLight);
  });
}
