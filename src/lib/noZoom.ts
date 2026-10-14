/**
 * Keeps the app at its default scale: blocks pinch-zoom and trackpad/ctrl-wheel zoom.
 * iOS Safari ignores `user-scalable=no`, so its gesture events are cancelled here too.
 * The campus map (Leaflet) is exempt so it can still be zoomed.
 */
const inMap = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest('.leaflet-container'));

export function disablePageZoom() {
  if (typeof document === 'undefined') return;
  const stop = (e: Event) => { if (!inMap(e.target)) e.preventDefault(); };
  // iOS Safari pinch gestures.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, stop, { passive: false });
  // Other mobile browsers: pinch is already off via `touch-action: pan-x pan-y` on <html> (see index.css).
  // No non-passive touchmove listener here — it would put every scroll on the main thread and make it stutter.
  // Trackpad pinch / ctrl + mouse wheel on desktop.
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) stop(e); }, { passive: false });
  // Keyboard zoom (Ctrl/⌘ + + / - / 0).
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
  });
}
