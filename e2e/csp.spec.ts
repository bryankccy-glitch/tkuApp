import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** Serve pages with the exact security headers from vercel.json and make sure nothing the app needs is blocked. */
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]));

for (const path of ['/', '/schedule', '/assistant', '/explore', '/me']) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), ...headers } });
    });
    await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { error: true } }));
    const violations: string[] = [];
    await page.exposeFunction('reportViolation', (v: string) => violations.push(v));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { reportViolation: (v: string) => void }).reportViolation(`${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#main')).toBeVisible();
    // tiles/fonts from the internet are unreachable in CI; only CSP-blocked loads count
    expect(violations).toEqual([]);
  });
}
