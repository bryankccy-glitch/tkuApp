import { useEffect, useState } from 'react';

export interface ViewportBox {
  /** Distance of the visible area from the top of the layout viewport (iOS scrolls the page for the keyboard). */
  top: number;
  /** Height of the visible area, i.e. what is left above the on-screen keyboard. */
  height: number;
}

/**
 * The visible part of the screen, from the VisualViewport API. Sizing a fixed layer to this box keeps
 * a chat screen glued to the keyboard on both iOS behaviours (page scrolled vs. layout resized) and on
 * Android, so the header stays put and the composer sits right on the keyboard.
 */
export function useVisualViewport(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBox({ top: Math.max(0, vv.offsetTop), height: vv.height }));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}
