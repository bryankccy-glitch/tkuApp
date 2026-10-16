import { registerSW } from 'virtual:pwa-register';

/**
 * Keep installed copies current. The default injected script only registered the service worker, so a
 * home-screen app kept showing the cached version until the browser happened to re-check `sw.js` and
 * the app was relaunched — sometimes several times. Here we check for a new version whenever the app
 * comes back to the foreground (and every 30 min), and `autoUpdate` reloads once the new one is active.
 */
export function installPwaUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', check);
      setInterval(check, 30 * 60 * 1000);
    },
  });
}
