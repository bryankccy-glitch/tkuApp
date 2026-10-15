/**
 * iOS home-screen (standalone) web apps have a WebKit bug: after the on-screen keyboard closes, the
 * page keeps a viewport ~one status bar shorter than the screen. Anything fixed to the bottom then
 * floats with a dark band under it for the rest of the session (window.innerHeight, visualViewport
 * and 100dvh all stay low; scrollTo/blur don't help). Toggling `display` on the full-height app root
 * forces WebKit to measure the viewport again, which restores the full height.
 * We only do this in standalone mode, only when the height is actually stuck, and hide the one-frame
 * relayout under a quick veil in the page's own background color.
 * See: dev.to/cederhook "Fixing the iOS standalone-PWA keyboard bug that shrinks your viewport".
 */
const isStandalone = () => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
};
const isField = (el: Element | null) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

let fullHeight = 0;
let busy = false;

/** True when the page is shorter than the tallest height seen while no keyboard was up. */
export function viewportStuck(): boolean {
  return !isField(document.activeElement) && fullHeight - window.innerHeight > 4;
}

function remeasure(root: HTMLElement) {
  // Keep every scroll position: the page itself and inner scroll areas marked data-keep-scroll.
  const pageY = window.scrollY;
  const inner = [...document.querySelectorAll<HTMLElement>('[data-keep-scroll]')].map((el) => [el, el.scrollTop] as const);
  root.style.display = 'none';
  void root.offsetHeight; // synchronous reflow while hidden
  root.style.display = '';
  window.scrollTo(0, pageY);
  for (const [el, top] of inner) el.scrollTop = top;
}

function fixIfStuck() {
  if (busy || !viewportStuck()) return;
  const root = document.getElementById('root');
  if (!root) return;
  busy = true;
  const veil = document.createElement('div');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.cssText = 'position:fixed;inset:-100px 0;z-index:9000;pointer-events:none;opacity:0;transition:opacity 120ms ease-out;background:rgb(var(--c-canvas))';
  document.body.appendChild(veil);
  requestAnimationFrame(() => { veil.style.opacity = '1'; });
  setTimeout(() => {
    remeasure(root);
    setTimeout(() => {
      veil.style.transition = 'opacity 220ms ease-out';
      veil.style.opacity = '0';
      setTimeout(() => { veil.remove(); busy = false; }, 260);
    }, 60);
  }, 140);
}

export function installIosViewportFix() {
  if (typeof window === 'undefined' || !isStandalone()) return;
  fullHeight = window.innerHeight;
  const track = () => {
    if (!isField(document.activeElement) && window.innerWidth < window.innerHeight) {
      fullHeight = Math.max(fullHeight, window.innerHeight);
    }
  };
  window.addEventListener('resize', track);
  // Keyboard closed: give iOS a moment to finish its own resize, then check.
  document.addEventListener('focusout', (e) => {
    if (!isField(e.target as Element)) return;
    setTimeout(fixIfStuck, 150);
    setTimeout(fixIfStuck, 600);
  });
  // Coming back to the app can also leave it short.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(fixIfStuck, 300); });
}

/** Test hook. */
export function _setFullHeightForTest(h: number) { fullHeight = h; }
