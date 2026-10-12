import { expect, test } from '@playwright/test';

const PAGES = ['/', '/schedule', '/tasks', '/assistant', '/explore', '/events', '/me', '/about'];

for (const path of PAGES) {
  test(`no horizontal page scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('navigation matches the viewport (bottom bar on phones, sidebar on desktop)', async ({ page, isMobile }) => {
  await page.goto('/');
  const bottom = page.locator('nav.fixed[aria-label="主要導覽"]');
  const sidebar = page.locator('aside nav[aria-label="主要導覽"]');
  if (isMobile) {
    await expect(bottom).toBeVisible();
    await expect(sidebar).toBeHidden();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottom).toBeHidden();
  }
  const nav = isMobile ? bottom : sidebar;
  await nav.getByRole('link', { name: '課表' }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(nav.getByRole('link', { name: '課表' })).toHaveAttribute('aria-current', 'page');
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
