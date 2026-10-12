import type { Ctx } from './pixel';
import { ditherFill, rect } from './pixel';
import type { Layout } from './layout';
import type { Palette, SceneState } from './sceneTypes';
import { css } from './palettes';
import { deckLightXs } from './PixelBridge';
import { hazeBands } from './PixelRain';

/** Bridge lights (126 landscape light poles in reality — represented by evenly spaced deck lamps). */
export function drawBridgeLights(ctx: Ctx, L: Layout, p: Palette, s: SceneState, time: number) {
  if (s.lights > 0.15) {
    for (const x of deckLightXs(L)) {
      rect(ctx, x, L.deckY - 2, 1, 1, p.bridgeLight, s.lights);
    }
    // pylon wash light at the base
    rect(ctx, L.pylonX - 1, L.deckY - 6, 2, 5, p.bridgeLight, 0.35 * s.lights);
  }
  // aviation warning light on the pylon top
  if (s.phase === 'night' || s.phase === 'dusk' || s.weather !== 'sunny') {
    const on = Math.floor(time / 900) % 2 === 0;
    if (on) rect(ctx, L.pylonX - 1, L.pylonTop - 2, 2, 1, [255, 70, 70]);
  }
}

export function drawFog(ctx: Ctx, L: Layout, p: Palette, s: SceneState) {
  if (!s.fog && !(s.weather === 'rainy' && s.rainIntensity > 0.6)) return;
  for (const b of hazeBands(L)) ditherFill(ctx, 0, b.y, L.W, b.h, p.haze, s.fog ? b.d : b.d * 0.5);
}

/** A soft vignette at the top keeps overlaid text readable (pixel-dithered, not blurred). */
export function drawTextShade(ctx: Ctx, L: Layout) {
  const h = Math.round(L.H * 0.3);
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = css([10, 10, 14], 0.22 * (1 - y / h));
    ctx.fillRect(0, y, L.W, 1);
  }
}
