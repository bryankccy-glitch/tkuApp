import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardInset } from '../useKeyboardInset';

function fakeViewport() {
  const listeners: Record<string, (() => void)[]> = {};
  const vv = {
    height: 800, offsetTop: 0,
    addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
    removeEventListener: () => {},
    fire: (t: string) => listeners[t]?.forEach((f) => f()),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  return vv;
}

describe('useKeyboardInset', () => {
  it('reports the keyboard height and flags <html> while it is open', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const vv = fakeViewport();
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);

    act(() => { vv.height = 460; vv.offsetTop = 40; vv.fire('resize'); }); // iOS: keyboard + page scrolled 40px
    expect(result.current).toBe(300);
    expect(document.documentElement.dataset.kb).toBe('open');

    act(() => { vv.height = 740; vv.offsetTop = 0; vv.fire('resize'); }); // toolbar change only
    expect(result.current).toBe(0);
    expect(document.documentElement.dataset.kb).toBeUndefined();
  });
});
