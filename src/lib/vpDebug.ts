/** TEMPORARY diagnostics for the iOS 26 short-viewport bug. Tap the AI assistant title 5× to open. */
import { applyShortViewport, nudgeViewport, shortBy } from './iosShortViewport';

let panel: HTMLDivElement | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const log: string[] = [];

function render() {
  if (!panel) return;
  const vv = window.visualViewport;
  const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  panel.querySelector('pre')!.textContent =
    `inner ${window.innerHeight} screen ${screen.height} vv ${vv?.height.toFixed(0)}/${vv?.offsetTop.toFixed(0)}\n` +
    `short ${shortBy()} vp-short ${document.documentElement.classList.contains('vp-short')} nav ${nav ? `${nav.top.toFixed(0)}-${nav.bottom.toFixed(0)}` : '-'}\n` +
    log.slice(-5).join('\n');
}

export function toggleVpDebug() {
  if (panel) { panel.remove(); panel = null; clearInterval(timer); return; }
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 60px);z-index:9999;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.35 ui-monospace,monospace;padding:8px;border-radius:8px';
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0 0 6px;white-space:pre-wrap';
  panel.appendChild(pre);
  const add = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin:2px;padding:6px 8px;background:#333;color:#fff;border-radius:6px;font:11px ui-monospace,monospace';
    b.onclick = (e) => {
      e.stopPropagation();
      const before = window.innerHeight;
      try { fn(); } catch (err) { log.push(`${label} err ${String(err)}`); }
      setTimeout(() => { log.push(`${label}: ${before}→${window.innerHeight}`); render(); }, 400);
      setTimeout(() => { log.push(`${label}+1.5s: ${window.innerHeight}`); applyShortViewport(); render(); }, 1500);
    };
    panel!.appendChild(b);
  };
  add('NUDGE', () => { nudgeViewport(); setTimeout(applyShortViewport, 250); });
  // Experiments (C plan): each one tries a different way to make iOS recompute the viewport height.
  const vpMeta = () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!;
  const swapMeta = (tmp: string) => {
    const m = vpMeta(); const orig = m.content;
    m.content = tmp;
    requestAnimationFrame(() => requestAnimationFrame(() => { m.content = orig; }));
  };
  add('META-fit', () => swapMeta('width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'));
  add('META-scale', () => swapMeta('width=device-width, initial-scale=1.01, maximum-scale=1.01, user-scalable=no, viewport-fit=cover'));
  add('META-height', () => swapMeta('width=device-width, height=device-height, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'));
  add('META-replace', () => {
    const m = vpMeta(); const n = document.createElement('meta');
    n.name = 'viewport'; n.content = m.content; m.remove();
    setTimeout(() => document.head.appendChild(n), 50);
  });
  add('SCROLL', () => {
    const s = document.createElement('div'); s.style.cssText = 'height:200vh;width:1px';
    document.body.appendChild(s); window.scrollTo(0, 1);
    setTimeout(() => { window.scrollTo(0, 0); s.remove(); }, 120);
  });
  add('FOCUS-text', () => {
    const i = document.createElement('input'); i.type = 'text';
    i.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;width:1px;height:1px';
    document.body.appendChild(i); i.focus();
    setTimeout(() => { i.blur(); i.remove(); }, 60);
  });
  add('STATUS-meta', () => {
    const m = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!m) return; const orig = m.content; m.content = 'default';
    setTimeout(() => { m.content = orig; }, 100);
  });
  add('THEME', () => {
    const m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!m) { log.push('no theme-color'); return; }
    const orig = m.content; m.content = '#000001';
    setTimeout(() => { m.content = orig; }, 100);
  });
  add('close', () => toggleVpDebug());
  document.body.appendChild(panel);
  render();
  timer = setInterval(render, 500);
}

let taps: number[] = [];
export function vpDebugTap() {
  const now = Date.now();
  taps = [...taps.filter((t) => now - t < 2000), now];
  if (taps.length >= 5) { taps = []; toggleVpDebug(); }
}
