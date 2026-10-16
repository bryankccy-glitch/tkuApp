import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(screenH: number, innerH: number, standalone = true) {
  vi.resetModules();
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  Object.defineProperty(window.screen, 'height', { value: screenH, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerH, configurable: true, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 402, configurable: true });
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  document.documentElement.className = '';
  document.body.innerHTML = '<div id="root"><button>tap</button><textarea></textarea></div>';
  return import('../iosShortViewport');
}

describe('iOS short viewport (WebKit 301108)', () => {
  afterEach(() => { (document.activeElement as HTMLElement | null)?.blur(); });

  it('flags the page and exposes the gap when the home-screen app is a status bar short', async () => {
    const mod = await load(874, 812);
    expect(mod.applyShortViewport()).toBe(62);
    expect(document.documentElement.classList.contains('vp-short')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--vp-gap')).toBe('62px');
  });

  it('stays off in the browser, at full height, and while the keyboard is up', async () => {
    expect((await load(874, 812, false)).applyShortViewport()).toBe(0);
    expect((await load(874, 874)).applyShortViewport()).toBe(0);
    const mod = await load(874, 812);
    document.querySelector('textarea')!.focus();
    expect(mod.applyShortViewport()).toBe(0);
    expect(document.documentElement.classList.contains('vp-short')).toBe(false);
  });

  it('nudges on the next tap, but not when the tap is on a text field', async () => {
    const mod = await load(874, 812);
    mod.installIosShortViewport();
    const nudged: Element[] = [];
    document.addEventListener('focusin', (e) => { if ((e.target as Element).hasAttribute('data-viewport-fix')) nudged.push(e.target as Element); });
    document.querySelector('button')!.click();
    expect(nudged).toHaveLength(1);
    document.querySelector('textarea')!.click();
    expect(nudged).toHaveLength(1);
    expect(document.querySelector('[data-viewport-fix]')).toBeNull();
  });

  it('scrolls 1px and back to make WebKit recompute the height, leaving nothing behind', async () => {
    vi.useFakeTimers();
    const mod = await load(874, 812);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    mod.fixShortViewport();
    expect(scroll).toHaveBeenCalledWith(0, 1);
    vi.advanceTimersByTime(500);
    expect(scroll).toHaveBeenLastCalledWith(0, 0);
    expect(document.querySelector('[data-viewport-spacer]')).toBeNull();
    for (let i = 0; i < 5; i += 1) { mod.fixShortViewport(); vi.advanceTimersByTime(500); }
    expect(scroll.mock.calls.filter((c) => c[1] === 1)).toHaveLength(3); // gives up after 3 tries per episode
    scroll.mockRestore();
    vi.useRealTimers();
  });
});
