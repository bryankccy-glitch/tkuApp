/**
 * iOS home-screen apps (seen on iOS 26) sometimes lay the page out shorter than the screen by about
 * the status-bar height, so anything fixed to `bottom: 0` floats above the real bottom with a strip
 * under it. We measure that gap (only in standalone mode, only while no field is focused — the
 * keyboard legitimately shrinks the page) and expose it as `--ios-gap` so the bottom nav and the
 * chat screen can reach the true bottom edge. Elsewhere it stays 0.
 */
const MAX_GAP = 90; // a status bar, never a keyboard

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function fieldFocused(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(el.type));
}

export function measureIosGap(): number {
  if (!isStandalone() || fieldFocused()) return 0;
  if (window.innerWidth > window.innerHeight) return 0; // portrait app; ignore odd rotations
  const gap = Math.round(window.screen.height - window.innerHeight);
  return gap > 0 && gap <= MAX_GAP ? gap : 0;
}

export function trackIosViewportGap() {
  if (typeof window === 'undefined') return;
  const apply = () => document.documentElement.style.setProperty('--ios-gap', `${measureIosGap()}px`);
  const later = () => { apply(); setTimeout(apply, 350); }; // after the keyboard animation settles
  apply();
  window.addEventListener('resize', later);
  window.visualViewport?.addEventListener('resize', later);
  document.addEventListener('focusin', later);
  document.addEventListener('focusout', later);
  window.addEventListener('pageshow', later);
}
