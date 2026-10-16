/**
 * iOS 26 home-screen apps with a translucent status bar (WebKit bug 301108): after the keyboard closes
 * (and sometimes at launch) the web view ends one status bar short of the screen bottom. The strip
 * below is outside the page and can't be painted, so anything fixed to the bottom floats above it.
 *
 * What we do (measured in the iOS 26.3 Simulator, iPhone 17 Pro: innerHeight 874 normally, 812 stuck):
 * 1. Detect it: standalone, no text field focused, and the page is 20–120px shorter than the screen.
 * 2. Hide it: set html.vp-short and --vp-gap. The missing strip already covers the home indicator, so
 *    the bottom inset shrinks by the gap and the nav sits flush; html's background is the nav color,
 *    so the strip reads as part of the nav.
 * 3. Undo it: briefly focusing + blurring a hidden read-only input restores the full height, but iOS
 *    only allows focus() inside a user gesture, so it runs on the next tap (not on a text field).
 */
const HELPER = 'data-viewport-fix';

const isStandalone = () => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
};
const isField = (el: Element | null) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

/** Missing px at the bottom, or 0 when the page fills the screen (or the keyboard is legitimately up). */
export function shortBy(): number {
  if (!isStandalone() || isField(document.activeElement)) return 0;
  if (window.innerWidth > window.innerHeight) return 0;
  const gap = Math.round((window.screen?.height ?? 0) - window.innerHeight);
  return gap >= 20 && gap <= 120 ? gap : 0;
}

export function applyShortViewport() {
  const gap = shortBy();
  const root = document.documentElement;
  root.classList.toggle('vp-short', gap > 0);
  root.style.setProperty('--vp-gap', `${gap}px`);
  return gap;
}

/** Focus + blur a hidden read-only input (no keyboard): makes WebKit restore the full height. */
export function nudgeViewport() {
  const input = document.createElement('input');
  input.readOnly = true;
  input.tabIndex = -1;
  input.setAttribute(HELPER, '');
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  document.body.appendChild(input);
  input.focus({ preventScroll: true });
  input.blur();
  input.remove();
}

function onGesture(e: Event) {
  if (!shortBy()) return;
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest('input, textarea, [contenteditable]')) return; // that tap wants the keyboard
  nudgeViewport();
  setTimeout(applyShortViewport, 250);
}

export function installIosShortViewport() {
  if (typeof window === 'undefined' || !isStandalone()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => { clearTimeout(timer); timer = setTimeout(applyShortViewport, 120); };
  applyShortViewport();
  window.addEventListener('resize', check);
  window.visualViewport?.addEventListener('resize', check);
  document.addEventListener('focusin', check);
  document.addEventListener('focusout', (e) => {
    if (e.target instanceof Element && e.target.hasAttribute(HELPER)) return;
    for (const ms of [150, 450, 900, 1600]) setTimeout(applyShortViewport, ms);
  });
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('touchend', onGesture, { capture: true, passive: true });
  document.addEventListener('click', onGesture, true);
}
