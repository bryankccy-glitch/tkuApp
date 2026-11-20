import { expect, test } from '@playwright/test';

test('3D map at 390px: buildings, controls, list, persistence and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: '地圖模式 3D' }).click();
  await expect(page.locator('[data-building="B"]')).toBeVisible();
  await expect(page.getByText(/示意高度：/)).toBeVisible();
  await page.getByRole('slider', { name: '旋轉' }).fill('45');
  await page.getByRole('slider', { name: '傾斜' }).fill('30');
  await page.getByRole('button', { name: /B 商管大樓/ }).click();
  await expect(page.locator('[data-building="B"]')).toHaveAttribute('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '地圖模式 3D' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.getByTestId('campus-3d').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.getByRole('button', { name: '地圖模式 2D' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
});
