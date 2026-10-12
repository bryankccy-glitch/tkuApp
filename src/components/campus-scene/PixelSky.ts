import type { Ctx } from './pixel';
import { BAYER4, disc, ditherGradient, rng } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css, mix } from './palettes';

/** Static sky: dithered gradient and the sun (with dithered halo) or crescent moon. */
export function drawSky(ctx: Ctx, L: Layout, p: Palette, s: SceneState) {
  const img = ctx.createImageData(L.W, L.H);
  ditherGradient(img, 0, 0, L.W, L.horizon + 1, [p.skyTop, p.skyMid, p.skyLow], 8);
  ctx.putImageData(img, 0, 0);

  // Sun travels right → left (east → west over the river mouth); moon sits high at night.
  const prog = s.sunProgress;
  if (s.phase !== 'night' && prog > -0.05 && prog < 1.06 && s.weather !== 'rainy') {
    const x = L.W * (0.88 - 0.62 * Math.min(1, Math.max(0, prog)));
    const y = L.horizon - 8 - Math.sin(Math.PI * Math.min(1, Math.max(0, prog))) * (L.horizon * 0.62);
    const glowR = 11;
    for (let yy = -glowR; yy <= glowR; yy++) {
      for (let xx = -glowR; xx <= glowR; xx++) {
        const d = Math.sqrt(xx * xx + yy * yy);
        if (d > glowR || d < 6) continue;
        const k = 1 - (d - 6) / (glowR - 6);
        if (k * (s.weather === 'cloudy' ? 0.35 : 0.75) > BAYER4[(Math.round(y) + yy) & 3]![(Math.round(x) + xx) & 3]!) {
          ctx.fillStyle = css(p.sunGlow);
          ctx.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1);
        }
      }
    }
    disc(ctx, x, y, 5, s.weather === 'cloudy' ? mix(p.sun, p.skyMid, 0.45) : p.sun);
  }
  if (s.phase === 'night') {
    const mx = Math.round(L.W * 0.5), my = Math.round(L.H * 0.27);
    disc(ctx, mx, my, 5, s.weather === 'sunny' ? p.moon : mix(p.moon, p.skyMid, 0.5));
    disc(ctx, mx + 3, my - 2, 4, p.skyTop); // crescent
  }

}

/** Static land on the far bank: hazy ridge, 觀音山 (Guanyin Mountain) and the Bali shoreline town. */
export function drawFarBank(ctx: Ctx, L: Layout, p: Palette, s: SceneState) {
  // far ridge across the whole width
  const r = rng(11);
  let hgt = 6;
  for (let x = 0; x < L.W; x++) {
    if (x % 3 === 0) hgt = Math.max(3, Math.min(11, hgt + Math.round((r() - 0.5) * 3)));
    ctx.fillStyle = css(p.mountainFar);
    ctx.fillRect(x, L.horizon - hgt, 1, hgt);
  }

  // 觀音山 — reclining profile on the Bali bank (left), in front of the far ridge
  const prof: [number, number][] = [[-0.05, 4], [0.06, 14], [0.13, 22], [0.19, 30], [0.24, 36], [0.28, 39], [0.32, 34], [0.36, 33], [0.41, 27], [0.47, 21], [0.54, 13], [0.6, 7], [0.66, 2]];
  const scale = L.H / 180;
  for (let x = 0; x < L.W; x++) {
    const fx = x / L.W;
    let h = 0;
    for (let i = 0; i < prof.length - 1; i++) {
      const [a, ha] = prof[i]!, [b, hb] = prof[i + 1]!;
      if (fx >= a && fx <= b) h = ha + ((hb - ha) * (fx - a)) / (b - a);
    }
    h = Math.round(h * scale + ((x * 7) % 3 === 0 ? 1 : 0));
    if (h <= 0) continue;
    const top = L.horizon - h;
    ctx.fillStyle = css(p.mountainNear);
    ctx.fillRect(x, top, 1, h);
    // haze toward the base
    for (let y = Math.max(top, L.horizon - 6); y < L.horizon; y++) {
      if ((L.horizon - y) / 6 < BAYER4[y & 3]![x & 3]! * 0.9) {
        ctx.fillStyle = css(mix(p.mountainNear, p.mountainFar, 0.6));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Bali shoreline town: small blocks with windows
  const t = rng(23);
  for (let x = Math.round(L.W * 0.03); x < L.W * 0.56; ) {
    const w = 3 + Math.floor(t() * 4);
    const h = 2 + Math.floor(t() * 6);
    ctx.fillStyle = css(p.townDark);
    ctx.fillRect(x, L.horizon - h, w, h);
    ctx.fillStyle = css(p.townLight);
    ctx.fillRect(x, L.horizon - h, w, 1);
    if (s.lights > 0.2) {
      for (let wy = L.horizon - h + 1; wy < L.horizon - 1; wy += 2) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (t() < 0.55 * s.lights) {
            ctx.fillStyle = css(p.windowLit);
            ctx.fillRect(wx, wy, 1, 1);
          }
        }
      }
    }
    x += w + (t() < 0.3 ? 2 : 1);
  }
}

/** Stars twinkle (animated, cheap). */
export function drawStars(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  if (s.phase !== 'night' || s.weather === 'rainy') return;
  const r = rng(5);
  const count = Math.round(L.W * (s.weather === 'cloudy' ? 0.06 : 0.16));
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * L.W);
    const y = Math.floor(r() * L.horizon * 0.55);
    const phase = r() * 6.28;
    const on = Math.sin(time * 0.0012 + phase) > -0.6;
    if (!on) continue;
    ctx.fillStyle = css(p.star, r() < 0.3 ? 1 : 0.65);
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Birds: an occasional small flock crossing the sky in daylight (2-frame wing flap). */
export function drawBirds(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  if (s.phase === 'night' || s.weather === 'rainy') return;
  const period = 22_000;
  const cycle = Math.floor(time / period);
  const local = (time % period) / 1000; // seconds into cycle
  const r = rng(cycle * 97 + 3);
  if (r() < 0.35) return; // some cycles have no birds
  const speed = 14 + r() * 6;
  const baseY = L.H * (0.18 + r() * 0.16);
  const x0 = -12 + local * speed;
  if (x0 > L.W + 12) return;
  const n = 3 + Math.floor(r() * 3);
  ctx.fillStyle = css(p.bird);
  for (let i = 0; i < n; i++) {
    const bx = Math.round(x0 - i * 5 - (i % 2) * 2);
    const by = Math.round(baseY + (i % 2 ? 3 : -1) * Math.ceil(i / 2) + Math.sin(time * 0.003 + i) * 1.2);
    const up = Math.floor(time / 160 + i) % 2 === 0;
    if (up) {
      ctx.fillRect(bx - 1, by - 1, 1, 1); ctx.fillRect(bx, by, 1, 1); ctx.fillRect(bx + 1, by - 1, 1, 1);
    } else {
      ctx.fillRect(bx - 1, by, 1, 1); ctx.fillRect(bx, by, 1, 1); ctx.fillRect(bx + 1, by, 1, 1);
    }
  }
}
