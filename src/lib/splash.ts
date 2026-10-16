/**
 * The boot splash (#boot in index.html) is a separate layer above the app. It stays up while anything
 * holds it (the initial render, a full-screen <BootScreen>) and fades out shortly after the last hold
 * is released, so the app underneath is already painted when it is revealed — no blank frame or
 * half-built screen in between. Once gone it never comes back; later full-screen loads render
 * <BootScreen> in React with the same look.
 */
import { retryShortViewport } from './iosShortViewport';

let holds = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let gone = false;

const el = () => (typeof document === 'undefined' ? null : document.getElementById('boot'));

export function splashShowing(): boolean {
  return !gone && el() !== null;
}

function hide() {
  const node = el();
  gone = true;
  document.documentElement.classList.add('app-ready');
  if (!node) return;
  node.classList.add('splash--out');
  node.setAttribute('aria-hidden', 'true');
  const remove = () => { node.remove(); retryShortViewport(); };
  node.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 600); // reduced motion / no transition
}

/** Keeps the splash up until the returned release function is called. */
export function holdSplash(): () => void {
  if (!splashShowing()) {
    if (typeof document !== 'undefined') document.documentElement.classList.add('app-ready');
    return () => {};
  }
  holds += 1;
  if (timer) clearTimeout(timer);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (timer) clearTimeout(timer);
    // Wait two frames + a beat so the next screen has painted (and a following BootScreen can take a hold).
    timer = setTimeout(() => { if (holds === 0) requestAnimationFrame(() => requestAnimationFrame(hide)); }, 80);
  };
}
