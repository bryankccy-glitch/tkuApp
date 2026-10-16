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
 * 3. Undo it: scrolling the window by 1px and back makes WebKit recompute the height (812→874 in the
 *    Simulator from the debug panel). This runs automatically after the keyboard closes and whenever the
 *    page is found short; the next tap also retries it, plus a focus/blur nudge as a fallback.
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

/** Scroll the window 1px and back (adding temporary room if the page can't scroll). */
export function scrollNudge() {
  const y = window.scrollY;
  const spacer = document.createElement('div');
  spacer.setAttribute('data-viewport-spacer', '');
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.cssText = 'height:200vh;width:1px;pointer-events:none';
  document.body.appendChild(spacer);
  window.scrollTo(0, y + 1);
  setTimeout(() => {
    window.scrollTo(0, y);
    spacer.remove();
  }, 120);
}

let attempts = 0;
let nudging = false;
/** Apply the fold; if the page is short, try the scroll nudge (a few times per episode) and re-check. */
export function fixShortViewport() {
  const gap = applyShortViewport();
  if (!gap) { attempts = 0; return; }
  if (nudging || attempts >= 3) return;
  attempts += 1;
  nudging = true;
  scrollNudge();
  setTimeout(() => { nudging = false; applyShortViewport(); }, 400);
}

function onGesture(e: Event) {
  if (!shortBy()) return;
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest('input, textarea, [contenteditable]')) return; // that tap wants the keyboard
  attempts = 0;
  scrollNudge();
  nudgeViewport();
  setTimeout(fixShortViewport, 400);
}

export function installIosShortViewport() {
  if (typeof window === 'undefined' || !isStandalone()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => { clearTimeout(timer); timer = setTimeout(fixShortViewport, 120); };
  fixShortViewport();
  window.addEventListener('resize', check);
  window.visualViewport?.addEventListener('resize', check);
  document.addEventListener('focusin', check);
  document.addEventListener('focusout', (e) => {
    if (e.target instanceof Element && e.target.hasAttribute(HELPER)) return;
    attempts = 0;
    for (const ms of [150, 600, 1200, 2000]) setTimeout(fixShortViewport, ms);
  });
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  document.addEventListener('touchend', onGesture, { capture: true, passive: true });
  document.addEventListener('click', onGesture, true);
}
