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

/** If loading stalls (slow network, a stuck request), offer a way out instead of an endless splash. */
export const STALL_MS = 12_000;
export function stallMessage(): { text: string; button: string } {
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
  return en
    ? { text: 'This is taking longer than usual. Try reloading.', button: 'Reload' }
    : { text: '載入比平常久，可以重新載入試試', button: '重新載入' };
}
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const node = el();
    if (gone || !node || node.querySelector('.splash-retry')) return;
    const { text, button } = stallMessage();
    const box = document.createElement('div');
    box.className = 'splash-retry';
    const msg = document.createElement('p');
    msg.textContent = text;
    msg.style.margin = '0';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = button;
    btn.addEventListener('click', () => window.location.reload());
    box.append(msg, btn);
    node.querySelector('.splash-bar')?.after(box);
  }, STALL_MS);
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
