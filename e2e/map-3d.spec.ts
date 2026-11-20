import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]));

test('3D at 390px: real canvas, attribution, selection, persistence, 2D restore and no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  // Offline fixture exercises the real renderer and worker under production CSP.
  // Empty tiles deliberately avoid inventing campus footprints; live data needs online QA.
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: {
    version: 8,
    sources: { openmaptiles: { type: 'vector', tiles: [] } },
    layers: [{ id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', paint: { 'fill-color': '#aaa' } }],
  } }));
  const violations: string[] = [];
  await page.exposeFunction('reportMapViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => {
    (window as unknown as { reportMapViolation: (v: string) => void }).reportMapViolation(`${e.violatedDirective} ${e.blockedURI}`);
  }));
  const downloads: string[] = [];
  page.on('request', (request) => downloads.push(request.url()));
  await page.goto('/explore');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(downloads.filter((url) => /CampusMap3D-/.test(url))).toEqual([]);
  await page.getByRole('button', { name: '地圖模式 3D' }).click();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toHaveAttribute('aria-label', '淡江校園 3D 地圖');
  for (const name of ['OpenStreetMap', 'OpenMapTiles', 'OpenFreeMap']) {
    await expect(page.locator('.maplibregl-ctrl-attrib').getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByText(/部分建築為示意高度/)).toBeVisible();
  await page.locator('[data-building="B"]').click();
  await expect(page.locator('ul button[aria-current="true"]')).toContainText('商管大樓');
  await page.locator('ul').getByRole('button', { name: /U 覺生紀念圖書館/ }).click();
  await expect(page.locator('[data-building="U"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '地圖模式 3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await page.getByRole('button', { name: '地圖模式 2D' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
  await page.locator('.leaflet-control-zoom-in').click();
  await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(violations).toEqual([]);
});

test('WebGL unavailable returns to usable 2D and keeps the building list', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/explore');
  await page.getByRole('button', { name: '地圖模式 3D' }).click();
  await expect(page.getByRole('status')).toContainText('已切回 2D');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('ul').getByRole('button', { name: /B 商管大樓/ }).click();
  await expect(page.getByRole('heading', { name: '商管大樓' })).toBeVisible();
});
