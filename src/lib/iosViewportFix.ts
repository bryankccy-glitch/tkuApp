/**
 * iOS home-screen (standalone) web apps have a WebKit bug (seen on iOS 26, Dynamic Island iPhones):
 * after the on-screen keyboard closes, the page keeps a viewport one status bar shorter than the
 * screen (e.g. innerHeight 874 → 812 on iPhone 17 Pro). Anything fixed to the bottom then floats
 * with a band under it until the app is killed.
 *
 * Verified in the iOS 26.3 Simulator (iPhone 17 Pro, home-screen app) with a diagnostics panel:
 * toggling `display` on the root, rewriting the viewport meta and scrollTo did NOT help; briefly
 * focusing and blurring a hidden read-only input DID restore the full height (812 → 874). A
 * read-only field doesn't open the keyboard, so nothing visible happens.
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
const isHelper = (el: EventTarget | null) => el instanceof Element && el.hasAttribute(HELPER);

let fullHeight = 0;
let busy = false;

/** True when the page is shorter than the tallest height seen while no keyboard was up. */
export function viewportStuck(): boolean {
  if (isField(document.activeElement) || window.innerWidth > window.innerHeight) return false;
  // In a standalone app the page normally fills the screen, so screen.height is the reference too.
  const full = Math.max(fullHeight, window.screen?.height ?? 0);
  const missing = full - window.innerHeight;
  return missing > 4 && missing < 120; // a status bar, never a keyboard
}

/** Focus + blur a hidden read-only input: makes WebKit restore the full-height viewport. */
export function nudgeViewport() {
  const input = document.createElement('input');
  input.readOnly = true;
  input.tabIndex = -1;
  input.setAttribute(HELPER, '');
  input.setAttribute('aria-hidden', 'true');
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  document.body.appendChild(input);
  input.focus({ preventScroll: true });
  setTimeout(() => {
    input.blur();
    input.remove();
  }, 50);
}

function fixIfStuck() {
  if (busy || !viewportStuck()) return;
  busy = true;
  nudgeViewport();
  setTimeout(() => { busy = false; }, 250);
}

export function installIosViewportFix() {
  if (typeof window === 'undefined' || !isStandalone()) return;
  fullHeight = window.innerHeight;
  window.addEventListener('resize', () => {
    if (!isField(document.activeElement) && window.innerWidth < window.innerHeight) {
      fullHeight = Math.max(fullHeight, window.innerHeight);
    }
  });
  // Keyboard closed: iOS animates for a while, and a nudge during the animation doesn't stick, so
  // check several times; each check only acts if the page is still short.
  document.addEventListener('focusout', (e) => {
    if (!isField(e.target as Element) || isHelper(e.target)) return;
    for (const ms of [300, 700, 1200, 2000]) setTimeout(fixIfStuck, ms);
  });
  // Any later resize that leaves the page short (no field focused) is checked too.
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.visualViewport?.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fixIfStuck, 350);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(fixIfStuck, 300); });
}

/** Test hook. */
export function _setFullHeightForTest(h: number) { fullHeight = h; }
