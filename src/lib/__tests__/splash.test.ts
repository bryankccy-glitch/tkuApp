import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshSplash() {
  vi.resetModules();
  document.body.innerHTML = '<div id="boot" class="splash"></div><div id="root"></div>';
  return import('../splash');
}

describe('boot splash layer', () => {
  afterEach(() => vi.useRealTimers());

  it('stays up while held and fades out only after the last hold is released', async () => {
    vi.useFakeTimers();
    const { holdSplash, splashShowing } = await freshSplash();
    const releaseA = holdSplash();
    const releaseB = holdSplash();
    releaseA();
    vi.advanceTimersByTime(200);
    expect(document.getElementById('boot')?.classList.contains('splash--out')).toBe(false);
    releaseB();
    releaseB(); // releasing twice is harmless
    vi.advanceTimersByTime(200);
    expect(document.getElementById('boot')?.classList.contains('splash--out')).toBe(true);
    expect(splashShowing()).toBe(false);
    vi.advanceTimersByTime(700);
    expect(document.getElementById('boot')).toBeNull();
  });

  it('a new hold right after a release keeps the splash up (no flash between loading steps)', async () => {
    vi.useFakeTimers();
    const { holdSplash } = await freshSplash();
    holdSplash()();
    const next = holdSplash();
    vi.advanceTimersByTime(500);
    expect(document.getElementById('boot')?.classList.contains('splash--out')).toBe(false);
    next();
    vi.advanceTimersByTime(200);
    expect(document.getElementById('boot')?.classList.contains('splash--out')).toBe(true);
  });
});
