/**
 * iOS shows an apple-touch-startup-image before the page loads and picks it by the PHONE's appearance
 * (prefers-color-scheme), not by the app's own 外觀 setting. With the phone dark and the app set to light
 * that meant a black launch screen, then the red splash. When the app has an explicit theme, point every
 * startup image at that theme's variant (dropping the color-scheme condition), so the launch screen and
 * the splash are one color. iOS reads these when the app launches, so a change shows from the next launch.
 */
export type SplashTheme = 'light' | 'dark' | 'system';

export function syncStartupImages(theme: SplashTheme, doc: Document = document) {
  doc.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-startup-image"]').forEach((link) => {
    const media = link.dataset.media ?? link.getAttribute('media') ?? '';
    const href = link.dataset.href ?? link.getAttribute('href') ?? '';
    link.dataset.media = media;
    link.dataset.href = href;
    if (theme === 'system') {
      link.setAttribute('media', media);
      link.setAttribute('href', href);
      return;
    }
    link.setAttribute('media', media.replace(/\s*and\s*\(prefers-color-scheme:\s*(light|dark)\)/, ''));
    link.setAttribute('href', href.replace(/\/splash\/(light|dark)-/, `/splash/${theme}-`));
  });
}
