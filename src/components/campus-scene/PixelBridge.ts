import type { Ctx } from './pixel';
import { line, rect } from './pixel';
import type { Layout } from './layout';
import type { Palette } from './sceneTypes';
import { css } from './palettes';

/**
 * 淡江大橋 (Danjiang Bridge), side elevation.
 * Verified (2026-10-12): single-pylon asymmetric cable-stayed bridge, pylon 211 m, main span 450 m,
 * back span 175 m, semi-fan stays, pylon set toward the Tamsui side; opened 2026-05-12.
 * Unverified, drawn as an interpretation: tapering single-shaft pylon outline and one central cable plane.
 * Proportions follow the numbers above: cables reach ~2.2× the pylon height on the main span, ~0.8× on the back span.
 */
export function bridgeGeometry(L: Layout) {
  const above = L.deckY - L.pylonTop; // pylon height above deck
  const anchors = 9;
  const mainReach = Math.round(above * 2.15);
  const backReach = Math.round(above * 0.8);
  const left: { ax: number; ay: number; dx: number }[] = [];
  const right: { ax: number; ay: number; dx: number }[] = [];
  for (let i = 0; i < anchors; i++) {
    const ay = L.pylonTop + 3 + Math.round(i * (above * 0.42) / (anchors - 1)); // semi-fan: anchors spread over the top ~40%
    const k = 1 - i / anchors;
    left.push({ ax: L.pylonX - 1, ay, dx: Math.round(L.pylonX - 6 - k * (mainReach - 6)) });
    if (i % 1 === 0 && i > 1) right.push({ ax: L.pylonX + 1, ay, dx: Math.round(L.pylonX + 5 + k * (backReach - 5)) });
  }
  return { left, right, above };
}

export function drawBridge(ctx: Ctx, L: Layout, p: Palette) {
  const g = bridgeGeometry(L);
  // stay cables (behind pylon)
  for (const c of g.left) line(ctx, c.ax, c.ay, c.dx, L.deckY, p.cable);
  for (const c of g.right) line(ctx, c.ax, c.ay, c.dx, L.deckY, p.cable);

  // deck: running surface + girder shadow
  rect(ctx, 0, L.deckY, L.W, 1, p.deck);
  rect(ctx, 0, L.deckY + 1, L.W, 2, p.deckShade);
  // parapet ticks
  ctx.fillStyle = css(p.deck);
  for (let x = 0; x < L.W; x += 3) ctx.fillRect(x, L.deckY - 1, 1, 1);

  // back-span & approach piers on the Tamsui side (right)
  const piers = [L.pylonX + Math.round(g.above * 0.85), L.pylonX + Math.round(g.above * 1.3), L.pylonX + Math.round(g.above * 1.75)];
  for (const x of piers) if (x < L.W) rect(ctx, x, L.deckY + 3, 2, L.horizon - L.deckY - 3 + 1, p.deckShade);

  // pylon: tapering single shaft, lit face left, shaded right
  for (let y = L.pylonTop; y <= L.horizon + 1; y++) {
    const t = Math.min(1, (y - L.pylonTop) / Math.max(1, L.deckY - L.pylonTop));
    const w = y > L.deckY ? 5 : Math.max(2, Math.round(2 + 3 * t));
    const x0 = L.pylonX - Math.floor(w / 2);
    rect(ctx, x0, y, w, 1, p.pylon);
    rect(ctx, x0 + w - 1, y, 1, 1, p.pylonShade);
  }
  rect(ctx, L.pylonX - 1, L.pylonTop - 1, 2, 1, p.pylonShade); // cap
}

export function deckLightXs(L: Layout): number[] {
  const xs: number[] = [];
  for (let x = 2; x < L.W; x += 6) xs.push(x);
  return xs;
}
