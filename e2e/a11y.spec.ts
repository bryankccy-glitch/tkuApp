import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/schedule', '/schedule?add=1', '/tasks', '/assistant', '/explore', '/events', '/me', '/about'];
const SAMPLE = {
  utc_offset_seconds: 28800,
  current: { time: '2026-10-12T15:45', temperature_2m: 26.4, relative_humidity_2m: 71, apparent_temperature: 28.1, precipitation: 0, rain: 0, weather_code: 2, cloud_cover: 42, wind_speed_10m: 11.2, is_day: 1 },
  daily: { sunrise: ['2026-10-12T05:52'], sunset: ['2026-10-12T17:30'] },
};

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`WCAG 2.2 AA: ${path} (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: SAMPLE }));
      await page.route('https://*.tile.openstreetmap.org/**', (r) => r.abort());
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.leaflet-container') // third-party map tiles/controls
        .analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}
