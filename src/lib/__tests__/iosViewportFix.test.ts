import { afterEach, describe, expect, it, vi } from 'vitest';

async function load({ innerH }: { innerH: number }) {
  vi.resetModules();
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerH, configurable: true, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 393, configurable: true });
  document.body.innerHTML = '<div id="root"><div data-keep-scroll style="overflow:auto"></div><textarea></textarea></div>';
  return import('../iosViewportFix');
}

describe('iOS standalone viewport fix', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('re-measures the app root after the keyboard leaves the page short', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const mod = await load({ innerH: 852 });
    mod.installIosViewportFix();
    const root = document.getElementById('root')!;
    const displays: string[] = [];
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'display');
    const style = root.style;
    let value = '';
    Object.defineProperty(style, 'display', { configurable: true, get: () => value, set: (v: string) => { value = v; displays.push(v); } });

    const ta = document.querySelector('textarea')!;
    ta.focus();
    (window as unknown as { innerHeight: number }).innerHeight = 793; // keyboard closed, but stuck short
    ta.blur();
    vi.advanceTimersByTime(150 + 140 + 60 + 260);
    expect(displays).toEqual(['none', '']);
    expect(document.querySelectorAll('body > div[aria-hidden]').length).toBe(0); // veil removed
    if (desc) Object.defineProperty(style, 'display', desc);
  });

  it('does nothing when the height came back by itself', async () => {
    vi.useFakeTimers();
    const mod = await load({ innerH: 852 });
    mod.installIosViewportFix();
    expect(mod.viewportStuck()).toBe(false);
    mod._setFullHeightForTest(852);
    (window as unknown as { innerHeight: number }).innerHeight = 850;
    expect(mod.viewportStuck()).toBe(false);
    (window as unknown as { innerHeight: number }).innerHeight = 793;
    expect(mod.viewportStuck()).toBe(true);
  });
});
