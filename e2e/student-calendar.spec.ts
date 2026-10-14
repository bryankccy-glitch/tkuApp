import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('month/year calendar and private event persistence', async ({ page }) => {
  await page.goto('/schedule');
  await page.getByRole('tab', { name: '月', exact: true }).click();
  await page.getByRole('button', { name: '新增行程', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新增行程' });
  await dialog.getByLabel('行程名稱', { exact: true }).fill('E2E 測試排班');
  await dialog.getByLabel('行程類型', { exact: true }).selectOption('work');
  await dialog.getByLabel('重複', { exact: true }).selectOption('weekly');
  await dialog.getByRole('button', { name: '儲存變更' }).click();
  await expect(page.getByRole('button', { name: 'E2E 測試排班', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '月', exact: true }).click();
  await expect(page.getByRole('button', { name: 'E2E 測試排班', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '年', exact: true }).click();
  await expect(page.getByRole('button', { name: /^12 月 / })).toBeVisible();
  await page.getByRole('button', { name: /^12 月 / }).click();
  await expect(page.getByRole('heading', { name: /年 12 月/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`calendar accessibility (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/schedule');
    for (const view of ['月', '年']) {
      await page.getByRole('tab', { name: view, exact: true }).click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).disableRules(['meta-viewport']).analyze();
      expect(results.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) }))).toEqual([]);
    }
    await page.getByRole('button', { name: '新增行程', exact: true }).click();
    const formResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).disableRules(['meta-viewport']).analyze();
    expect(formResults.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) }))).toEqual([]);
  });
}
