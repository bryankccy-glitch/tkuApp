import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Palette, SceneState } from './sceneTypes';
import { mixPalette, PHASE_PALETTES, weatherPalette } from './palettes';
import { layoutFor, type Layout } from './layout';
import { drawBirds, drawFarBank, drawSky, drawStars } from './PixelSky';
import { drawCloudShadows, drawClouds, planClouds, type CloudPlan } from './PixelClouds';
import { drawRiverBase, drawRiverMotion } from './PixelRiver';
import { drawBridge } from './PixelBridge';
import { drawRain, drawRipples } from './PixelRain';
import { drawTerrain, drawTrees } from './PixelTerrain';
import { drawBridgeLights, drawFog, drawTextShade } from './PixelLighting';

const BASE_ART_HEIGHT = 180; // art pixels the scene is designed around
const FPS = 15;
const TRANSITION_MS = 2500;

function targetPalette(s: SceneState): Palette {
  return weatherPalette(PHASE_PALETTES[s.phase], s.weather, s.phase);
}

/** Bucketed key: caches re-render only when something visible in the static layers changes. */
function staticKey(s: SceneState, L: Layout) {
  return [L.W, L.H, s.phase, s.weather, s.fog, Math.round(s.sunProgress * 60), Math.round(s.lights * 4)].join('|');
}

interface Caches {
  sky: HTMLCanvasElement;
  bank: HTMLCanvasElement;
  front: HTMLCanvasElement;
  key: string;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Animated pixel-art scene of 淡江大橋 seen from the Tamsui campus.
 * Real low-resolution canvas scaled by an integer device-pixel factor (`image-rendering: pixelated`).
 */
export function PixelCampusScene({ scene, label, className }: { scene: SceneState; label: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const state = useRef({
    layout: null as Layout | null,
    caches: null as Caches | null,
    clouds: [] as CloudPlan[],
    cloudKey: '',
    from: null as Palette | null,
    to: null as Palette | null,
    paletteKey: '',
    transStart: 0,
    visible: true,
    raf: 0,
    last: 0,
    redraw: () => {},
  });

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext('2d', { alpha: false });
    if (!ctx) return; // e.g. jsdom
    const st = state.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const frameMs = 1000 / (saveData ? 8 : FPS);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = el.clientWidth;
      const cssH = el.clientHeight;
      if (!cssW || !cssH) return;
      const k = Math.max(2, Math.round((cssH * dpr) / BASE_ART_HEIGHT)); // device px per art px
      const W = Math.ceil((cssW * dpr) / k);
      const H = Math.ceil((cssH * dpr) / k);
      cv.width = W;
      cv.height = H;
      cv.style.width = `${(W * k) / dpr}px`;
      cv.style.height = `${(H * k) / dpr}px`;
      st.layout = layoutFor(W, H);
      st.caches = null;
      st.cloudKey = '';
      st.redraw();
    };

    const blended = (now: number): { pal: Palette; animating: boolean } => {
      const t = reduced ? 1 : Math.min(1, (now - st.transStart) / TRANSITION_MS);
      const eased = t * t * (3 - 2 * t);
      return { pal: t >= 1 || !st.from ? st.to! : mixPalette(st.from, st.to!, eased), animating: t < 1 };
    };
    const currentPalette = (now: number): { pal: Palette; animating: boolean } => {
      const s = sceneRef.current;
      const key = `${s.phase}|${s.weather}`;
      if (key !== st.paletteKey) {
        const target = targetPalette(s);
        // Start a soft cross-fade from whatever is on screen now.
        st.from = st.to ? blended(now).pal : target;
        st.to = target;
        st.paletteKey = key;
        st.transStart = now;
      }
      return blended(now);
    };

    const render = (now: number) => {
      const L = st.layout;
      if (!L) return;
      const s = sceneRef.current;
      const { pal, animating } = currentPalette(now);
      const key = staticKey(s, L);
      if (!st.caches || st.caches.key !== key || animating) {
        const c = st.caches && st.caches.sky.width === L.W && st.caches.sky.height === L.H
          ? st.caches
          : { sky: makeCanvas(L.W, L.H), bank: makeCanvas(L.W, L.H), front: makeCanvas(L.W, L.H), key: '' };
        const sx = c.sky.getContext('2d')!, bx = c.bank.getContext('2d')!, fx = c.front.getContext('2d')!;
        sx.clearRect(0, 0, L.W, L.H); bx.clearRect(0, 0, L.W, L.H); fx.clearRect(0, 0, L.W, L.H);
        drawSky(sx, L, pal, s);
        drawFarBank(bx, L, pal, s);
        drawRiverBase(bx, L, pal);
        drawBridge(fx, L, pal);
        drawTerrain(fx, L, pal, s);
        c.key = animating ? '' : key;
        st.caches = c;
      }
      const ck = `${L.W}|${L.H}|${s.weather}|${Math.round(s.cloudCover * 10)}|${Math.round(s.windSpeed / 5)}`;
      if (ck !== st.cloudKey) {
        st.clouds = planClouds(L, s);
        st.cloudKey = ck;
      }
      const time = reduced ? 40_000 : now;
      ctx.drawImage(st.caches.sky, 0, 0);
      drawStars(ctx, L, pal, s, time);
      drawClouds(ctx, L, pal, st.clouds, time);
      ctx.drawImage(st.caches.bank, 0, 0);
      drawRiverMotion(ctx, L, pal, s, time);
      drawCloudShadows(ctx, L, pal, st.clouds, s, time);
      drawRipples(ctx, L, pal, s, time);
      ctx.drawImage(st.caches.front, 0, 0);
      drawTrees(ctx, L, pal, s, time);
      drawBirds(ctx, L, pal, s, time);
      drawBridgeLights(ctx, L, pal, s, time);
      drawRain(ctx, L, pal, s, time);
      drawFog(ctx, L, pal, s);
      drawTextShade(ctx, L);
      return animating;
    };

    const loop = (now: number) => {
      st.raf = requestAnimationFrame(loop);
      if (now - st.last < frameMs) return;
      st.last = now;
      render(now);
    };
    const start = () => {
      if (st.raf || reduced || !st.visible || document.hidden) return;
      st.raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    st.redraw = () => {
      // Reduced motion: still frame; palette changes jump directly (no transition loop).
      render(performance.now());
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    resize();
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => {
          st.visible = !!e?.isIntersecting;
          if (st.visible) start(); else stop();
        })
      : null;
    io?.observe(el);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      stop();
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  // Scene changes while paused (reduced motion / off-screen) still update the still frame.
  useEffect(() => {
    if (!state.current.raf) state.current.redraw();
  }, [scene]);

  return (
    <div ref={wrap} className={cn('absolute inset-0 overflow-hidden', className)} role="img" aria-label={label} data-scene={scene.kind} data-animating={reduced ? 'false' : 'true'}>
      <canvas ref={canvas} className="block [image-rendering:pixelated]" aria-hidden />
    </div>
  );
}
