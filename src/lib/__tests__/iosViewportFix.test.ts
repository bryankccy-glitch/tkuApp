import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(innerH: number) {
  vi.resetModules();
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerH, configurable: true, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 402, configurable: true });
  Object.defineProperty(window.screen, 'height', { value: innerH, configurable: true });
  document.body.innerHTML = '<div id="root"><textarea></textarea></div>';
  return import('../iosViewportFix');
}
const setInner = (h: number) => { (window as unknown as { innerHeight: number }).innerHeight = h; };

describe('iOS standalone viewport fix', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('after the keyboard leaves the page short, briefly focuses a hidden read-only field', async () => {
    vi.useFakeTimers();
    const mod = await load(874);
    mod.installIosViewportFix();
    const focused: HTMLInputElement[] = [];
    document.addEventListener('focusin', (e) => { if ((e.target as Element).hasAttribute('data-viewport-fix')) focused.push(e.target as HTMLInputElement); });

    const ta = document.querySelector('textarea')!;
    ta.focus();
    setInner(812); // keyboard closed but stuck short (measured in the iOS 26.3 Simulator)
    ta.blur();
    vi.advanceTimersByTime(300);
    expect(focused).toHaveLength(1);
    expect(focused[0]!.readOnly).toBe(true);
    vi.advanceTimersByTime(100);
    expect(document.querySelector('[data-viewport-fix]')).toBeNull(); // helper removed again
  });

  it('the first tap after the page got stuck also nudges (iOS only allows focus() in a gesture)', async () => {
    vi.useFakeTimers();
    const mod = await load(874);
    mod.installIosViewportFix();
    setInner(812);
    const nudged: Element[] = [];
    document.addEventListener('focusin', (e) => { if ((e.target as Element).hasAttribute('data-viewport-fix')) nudged.push(e.target as Element); });
    document.getElementById('root')!.click();
    expect(nudged).toHaveLength(1);
    vi.advanceTimersByTime(100);
    document.querySelector('textarea')!.click(); // tapping a field: let it get the keyboard
    expect(nudged).toHaveLength(2 - 1);
  });

  it('does nothing when the height is fine or a field is still focused', async () => {
    vi.useFakeTimers();
    const mod = await load(874);
    mod._setFullHeightForTest(874);
    expect(mod.viewportStuck()).toBe(false);
    setInner(812);
    expect(mod.viewportStuck()).toBe(true);
    document.querySelector('textarea')!.focus();
    expect(mod.viewportStuck()).toBe(false); // keyboard legitimately shrinks the page
  });
});
