import { expect, test } from '@playwright/test';

/** With English selected, core screens contain no Chinese UI text (proper nouns like building names excepted). */
const PAGES = ['/', '/schedule', '/schedule?add=1', '/tasks', '/tasks?add=1', '/assistant', '/events', '/me'];
const ALLOWED = ['繁體中文']; // language switch option

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('tku.lang', 'en'));
});

for (const path of PAGES) {
  test(`English UI on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    let text = await page.locator('body').innerText();
    for (const a of ALLOWED) text = text.replaceAll(a, '');
    const cjk = text.match(/[一-鿿][一-鿿\w\s]{0,12}/g) ?? [];
    expect(cjk, `Chinese text on ${path}: ${cjk.join(' | ')}`).toEqual([]);
  });
}

test('English: add a course and see English validation and toasts', async ({ page }) => {
  await page.goto('/schedule?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add course' });
  await page.getByRole('button', { name: 'Add to schedule' }).click();
  await expect(dialog.getByText('Enter a course name')).toBeVisible();
  await dialog.getByLabel('Course name').fill('Linear Algebra');
  await dialog.getByLabel('Room').fill('S101');
  await page.getByRole('button', { name: 'Add to schedule' }).click();
  await expect(page.getByText('Added “Linear Algebra”')).toBeVisible();
});

test('English: the on-device assistant understands English questions', async ({ page }) => {
  await page.goto('/assistant');
  await page.getByLabel('Your question').fill('How do I take sick leave?');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Student leave regulations/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy answer' })).toHaveCount(1); // first answer finished streaming
  await page.getByLabel('Your question').fill('What time is period 5?');
  await page.keyboard.press('Enter');
  await expect(page.getByText('12:10–13:00')).toBeVisible();
  await expect(page.getByRole('link', { name: /淡江大學學生請假規則/ })).toBeVisible(); // official title kept as cited
});
