import { describe, expect, it } from 'vitest';
import { syncStartupImages } from '../startupImage';

const LIGHT = 'screen and (device-width: 402px) and (orientation: portrait) and (prefers-color-scheme: light)';
const DARK = 'screen and (device-width: 402px) and (orientation: portrait) and (prefers-color-scheme: dark)';

function setup() {
  document.head.innerHTML = `
    <link rel="apple-touch-startup-image" href="/splash/light-1206x2622.png" media="${LIGHT}">
    <link rel="apple-touch-startup-image" href="/splash/dark-1206x2622.png" media="${DARK}">`;
  return [...document.querySelectorAll('link')];
}

describe('launch screen follows the app theme', () => {
  it('app set to light: red launch image whatever the phone appearance', () => {
    const links = setup();
    syncStartupImages('light');
    for (const l of links) {
      expect(l.getAttribute('href')).toBe('/splash/light-1206x2622.png');
      expect(l.getAttribute('media')).not.toContain('prefers-color-scheme');
    }
  });

  it('app set to dark: black launch image; back to system restores the phone-based choice', () => {
    const links = setup();
    syncStartupImages('dark');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/splash/dark-1206x2622.png', '/splash/dark-1206x2622.png']);
    syncStartupImages('system');
    expect(links[0]!.getAttribute('media')).toBe(LIGHT);
    expect(links[1]!.getAttribute('href')).toBe('/splash/dark-1206x2622.png');
    expect(links[0]!.getAttribute('href')).toBe('/splash/light-1206x2622.png');
  });
});
