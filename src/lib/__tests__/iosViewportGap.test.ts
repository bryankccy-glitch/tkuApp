import { afterEach, describe, expect, it } from 'vitest';
import { measureIosGap } from '../iosViewportGap';

function setup({ standalone, screenH, innerH, innerW = 393 }: { standalone: boolean; screenH: number; innerH: number; innerW?: number }) {
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  Object.defineProperty(window.screen, 'height', { value: screenH, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerH, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: innerW, configurable: true });
}

describe('measureIosGap', () => {
  afterEach(() => { (document.activeElement as HTMLElement | null)?.blur(); document.body.innerHTML = ''; });

  it('reports the missing status-bar strip in a home-screen app', () => {
    setup({ standalone: true, screenH: 852, innerH: 793 });
    expect(measureIosGap()).toBe(59);
  });

  it('is 0 in the browser, when the page fills the screen, or while typing (keyboard)', () => {
    setup({ standalone: false, screenH: 852, innerH: 793 });
    expect(measureIosGap()).toBe(0);
    setup({ standalone: true, screenH: 852, innerH: 852 });
    expect(measureIosGap()).toBe(0);
    setup({ standalone: true, screenH: 852, innerH: 793 });
    document.body.innerHTML = '<textarea></textarea>';
    document.querySelector('textarea')!.focus();
    expect(measureIosGap()).toBe(0);
  });

  it('never mistakes a keyboard-sized difference for the gap', () => {
    setup({ standalone: true, screenH: 852, innerH: 500 });
    expect(measureIosGap()).toBe(0);
  });
});
