import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisualViewport } from '../useVisualViewport';

describe('useVisualViewport', () => {
  it('follows the visible area as the keyboard opens and iOS scrolls the page', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const listeners: Record<string, (() => void)[]> = {};
    const vv = { height: 800, offsetTop: 0, addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); }, removeEventListener: () => {} };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toEqual({ top: 0, height: 800 });
    act(() => { vv.height = 460; vv.offsetTop = 40; listeners.resize?.forEach((f) => f()); });
    expect(result.current).toEqual({ top: 40, height: 460 });
  });
});
