import { expect, test } from '@playwright/test';

const PAGES = ['/', '/schedule', '/tasks', '/assistant', '/explore', '/events', '/me', '/about'];

for (const path of PAGES) {
  test(`no horizontal page scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Even if something grows 1px too wide later, the page itself must not move sideways.
    await page.evaluate(() => {
      const wide = document.createElement('div');
      wide.style.cssText = 'width:150vw;height:1px';
      document.body.appendChild(wide);
      window.scrollTo(80, window.scrollY);
    });
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
}

test('app layout: bottom navigation on every screen size, phone-width frame on large screens', async ({ page }) => {
  await page.goto('/');
  const bottom = page.locator('nav[aria-label="主要導覽"]');
  await expect(bottom).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  const frame = await page.locator('.app-frame').boundingBox();
  const vw = page.viewportSize()!.width;
  expect(frame!.width).toBeLessThanOrEqual(Math.min(vw, 480));
  const navBox = await bottom.boundingBox();
  expect(Math.round(navBox!.x)).toBe(Math.round(frame!.x));
  await bottom.getByRole('link', { name: '課表' }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(bottom.getByRole('link', { name: '課表' })).toHaveAttribute('aria-current', 'page');
});

test('week view fits the phone width without sideways scrolling', async ({ page }) => {
  await page.goto('/schedule?add=1');
  const dialog = page.getByRole('dialog', { name: '新增課程' });
  await dialog.getByLabel('課程名稱').fill('週課表測試');
  await page.getByRole('button', { name: '加入課表' }).click();
  await page.getByRole('tab', { name: '週課表' }).click();
  const grid = page.locator('.app-frame .overflow-hidden.rounded-lg').first();
  const box = await grid.boundingBox();
  const frame = await page.locator('.app-frame').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(frame!.x + frame!.width);
  await expect(page.getByRole('link', { name: /週一 08:10–10:00 週課表測試/ })).toBeVisible();
});

test('PWA manifest and service worker are installable', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest.name).toContain('TKU Campus OS');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    return Boolean(reg);
  });
  expect(swReady).toBe(true);
});

test('keyboard users can skip to main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '跳到主要內容' });
  await expect(skip).toBeFocused();
});

test('layout stays at default scale: zoom gestures are blocked, scrolling still works', async ({ page }) => {
  await page.goto('/schedule');
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).toContain('maximum-scale=1.0');
  expect(meta).toContain('user-scalable=no');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('pan-x pan-y');
  const blocked = await page.evaluate(() => {
    const fire = (e: Event) => { document.body.dispatchEvent(e); return e.defaultPrevented; };
    return {
      ctrlWheel: fire(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true })),
      plainWheel: fire(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })),
      iosPinch: fire(new Event('gesturestart', { bubbles: true, cancelable: true })),
    };
  });
  expect(blocked).toEqual({ ctrlWheel: true, plainWheel: false, iosPinch: true });
});
