import type { Ctx } from './pixel';
import { rng } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css } from './palettes';

/**
 * Rain without a particle system: each drop's position is a pure function of time,
 * so there is no per-frame allocation. Count scales with rain intensity.
 */
export function drawRain(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  if (s.weather !== 'rainy') return;
  const n = Math.round(L.W * (0.25 + s.rainIntensity * 0.75));
  const r = rng(303);
  const t = time / 1000;
  const slant = Math.min(2, Math.max(0.3, s.windSpeed / 12));
  ctx.fillStyle = css(p.rain, 0.75);
  for (let i = 0; i < n; i++) {
    const speed = 70 + r() * 50;
    const x0 = r() * (L.W + 40);
    const phase = r() * L.H;
    const y = (phase + t * speed) % (L.H + 6) - 4;
    const x = Math.round((x0 - (y / 3) * (slant / 2)) % (L.W + 20)) - 4;
    const yi = Math.round(y);
    ctx.fillRect(x, yi, 1, 1);
    ctx.fillRect(x, yi + 1, 1, 1);
    ctx.fillRect(x - (slant > 1 ? 1 : 0), yi + 2, 1, 1);
  }
}

/** Ripples on the water: short-lived expanding marks at deterministic spots. */
export function drawRipples(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  if (s.weather !== 'rainy') return;
  const slots = Math.round(6 + s.rainIntensity * 18);
  const tick = Math.floor(time / 90);
  ctx.fillStyle = css(p.riverShine, 0.6);
  for (let i = 0; i < slots; i++) {
    const life = (tick + i * 3) % 9; // 0..8
    if (life > 3) continue;
    const r = rng(Math.floor((tick + i * 3) / 9) * 977 + i * 131);
    const x = Math.floor(r() * L.W);
    const y = L.horizon + 2 + Math.floor(r() * (L.H - L.horizon - 3));
    if (life === 0) ctx.fillRect(x, y, 1, 1);
    else if (life === 1) ctx.fillRect(x - 1, y, 3, 1);
    else { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); }
  }
}

/** Fog: dithered haze across the far bank and the bridge. */
export function hazeBands(L: Layout): { y: number; h: number; d: number }[] {
  return [
    { y: Math.round(L.horizon - L.H * 0.22), h: Math.round(L.H * 0.12), d: 0.35 },
    { y: Math.round(L.horizon - L.H * 0.1), h: Math.round(L.H * 0.14), d: 0.5 },
  ];
}
