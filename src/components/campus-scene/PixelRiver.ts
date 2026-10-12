import type { Ctx } from './pixel';
import { ditherGradient, rng } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css, mix } from './palettes';
import { deckLightXs } from './PixelBridge';

/** Static water body (dithered gradient). */
export function drawRiverBase(ctx: Ctx, L: Layout, p: Palette) {
  const h = L.H - L.horizon;
  const img = ctx.getImageData(0, L.horizon, L.W, h);
  const tmp = new ImageData(L.W, L.H);
  ditherGradient(tmp, 0, L.horizon, L.W, h, [p.river, p.riverDeep], 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < L.W; x++) {
      const si = ((L.horizon + y) * L.W + x) * 4;
      const di = (y * L.W + x) * 4;
      img.data[di] = tmp.data[si]!;
      img.data[di + 1] = tmp.data[si + 1]!;
      img.data[di + 2] = tmp.data[si + 2]!;
      img.data[di + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, L.horizon);
}

/** Animated: shimmer lines, pylon & sun reflections, night light streaks. */
export function drawRiverMotion(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  const t = time / 1000;
  const r = rng(77);
  const shimmerCount = Math.round(L.W * (s.weather === 'sunny' ? 0.16 : 0.08));
  // shimmer dashes drifting slowly
  for (let i = 0; i < shimmerCount; i++) {
    const y = L.horizon + 2 + Math.floor(r() * (L.H - L.horizon - 4));
    const len = 2 + Math.floor(r() * 4);
    const speed = 1.5 + r() * 2.5;
    const x = Math.floor((r() * L.W + t * speed) % (L.W + len)) - len;
    const vis = Math.sin(t * 1.3 + i) > -0.2;
    if (!vis) continue;
    ctx.fillStyle = css(mix(p.riverShine, p.river, 0.35), 0.8);
    ctx.fillRect(x, y, len, 1);
  }

  // pylon reflection: broken vertical streak that wobbles
  const refl = mix(p.pylon, p.river, 0.55);
  for (let y = L.horizon + 1; y < Math.min(L.H, L.horizon + (L.deckY - L.pylonTop) * 0.7); y++) {
    if ((y + Math.floor(t * 4)) % 3 === 0) continue;
    const wob = Math.round(Math.sin(t * 2 + y * 0.7));
    ctx.fillStyle = css(refl);
    ctx.fillRect(L.pylonX - 1 + wob, y, 2, 1);
  }

  // sun glitter column
  const prog = s.sunProgress;
  if (s.phase !== 'night' && s.weather !== 'rainy' && prog > 0 && prog < 1.04) {
    const sx = Math.round(L.W * (0.88 - 0.62 * Math.min(1, prog)));
    for (let y = L.horizon + 1; y < L.H; y += 2) {
      const w = 1 + Math.floor(((y - L.horizon) / (L.H - L.horizon)) * 5);
      const jitter = Math.round(Math.sin(t * 3 + y) * 2);
      if (Math.sin(t * 5 + y * 1.7) < -0.3) continue;
      ctx.fillStyle = css(s.phase === 'dusk' ? p.sunGlow : p.riverShine, s.weather === 'cloudy' ? 0.45 : 0.9);
      ctx.fillRect(sx - Math.floor(w / 2) + jitter, y, w, 1);
    }
  }

  // night: bridge light & moon streaks
  if (s.lights > 0.3) {
    for (const x of deckLightXs(L)) {
      for (let y = L.horizon + 2; y < L.horizon + 2 + 10; y += 2) {
        if (Math.sin(t * 4 + x + y) < -0.4) continue;
        ctx.fillStyle = css(p.bridgeLight, 0.55 * s.lights);
        ctx.fillRect(x + Math.round(Math.sin(t * 2 + y)), y, 1, 1);
      }
    }
  }
  if (s.phase === 'night' && s.weather === 'sunny') {
    const mx = Math.round(L.W * 0.5);
    for (let y = L.horizon + 2; y < L.H; y += 3) {
      ctx.fillStyle = css(p.moon, 0.5);
      ctx.fillRect(mx - 1 + Math.round(Math.sin(t * 2 + y)), y, 3, 1);
    }
  }
}
