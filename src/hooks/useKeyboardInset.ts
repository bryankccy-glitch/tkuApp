import { useEffect, useState } from 'react';

/**
 * How many CSS px of the layout viewport the on-screen keyboard covers (0 when closed), from the
 * VisualViewport API. While it is open, `<html data-kb="open">` is set so the bottom nav can hide.
 * iOS doesn't resize the page for the keyboard; it scrolls it instead, which made fixed/sticky
 * bars jump. Anchoring to the visual viewport keeps the composer right above the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Ignore small differences (browser toolbars collapsing); a keyboard is far taller.
        const next = covered > 120 ? covered : 0;
        setInset(next);
        if (next) document.documentElement.dataset.kb = 'open';
        else delete document.documentElement.dataset.kb;
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      delete document.documentElement.dataset.kb;
    };
  }, []);
  return inset;
}
