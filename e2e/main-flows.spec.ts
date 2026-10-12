import { expect, test, type Page } from '@playwright/test';

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

async function addCourseToday(page: Page, name: string, room: string) {
  await page.goto('/schedule?add=1');
  const dialog = page.getByRole('dialog', { name: '新增課程' });
  await dialog.getByLabel('課程名稱').fill(name);
  await dialog.getByLabel('授課教師').fill('測試教師');
  await dialog.getByLabel('星期').selectOption({ label: WEEKDAYS[new Date().getDay()]! });
  await dialog.getByLabel('教室').fill(room);
  await dialog.getByLabel('開始').fill('23:00');
  await dialog.getByLabel('結束').fill('23:50');
  await page.getByRole('button', { name: '加入課表' }).click();
  await expect(page.getByText(`已加入「${name}」`)).toBeVisible();
}

test('course added in 課表 appears on the home dashboard', async ({ page }) => {
  await addCourseToday(page, '端對端測試課', 'FL105');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('淡江同學');
  await expect(page.getByRole('region', { name: /今日課表/ }).or(page.locator('section[aria-labelledby="today-title"]'))).toContainText('端對端測試課');
  await expect(page.locator('section[aria-labelledby="next-class"]')).toContainText('外國語文大樓');
});

test('conflicting course is flagged in the week view', async ({ page }) => {
  await addCourseToday(page, '課程甲', 'E304');
  await addCourseToday(page, '課程乙', 'E305');
  await page.goto('/schedule');
  await expect(page.getByRole('alert')).toContainText('有 1 組課程時間衝突');
});

test('task lifecycle: add, complete, listed under 已完成', async ({ page }) => {
  await page.goto('/tasks?add=1');
  const dialog = page.getByRole('dialog', { name: '新增作業或考試' });
  await dialog.getByLabel('標題').fill('E2E 報告');
  await dialog.getByLabel('類型').selectOption('report');
  await dialog.getByRole('button', { name: '新增' }).click();
  await page.getByRole('tab', { name: '全部' }).click();
  await page.getByRole('checkbox', { name: '標記為已完成：E2E 報告' }).click();
  await expect(page.getByText('完成了！')).toBeVisible();
  await page.getByRole('tab', { name: '已完成' }).click();
  await expect(page.getByText('E2E 報告', { exact: true })).toBeVisible();
});

test('CSV import adds courses', async ({ page }) => {
  await page.goto('/schedule');
  await page.getByRole('button', { name: '匯入 CSV' }).first().click();
  const csv = '課程名稱,課號,教授,星期,開始,結束,教室,顏色,備註\n線性代數,,李老師,2,10:10,12:00,S102,teal,\n線性代數,,李老師,4,10:10,11:00,S102,teal,\n';
  await page.locator('input[type=file]').setInputFiles({ name: 'courses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('將匯入')).toBeVisible();
  await page.getByRole('button', { name: '匯入 1 門課' }).click();
  await expect(page.getByText('已匯入 1 門課')).toBeVisible();
});

test('campus explorer finds the building for a room code', async ({ page }) => {
  await page.goto('/explore');
  await page.getByLabel('搜尋建築或教室').fill('HC306');
  await page.getByRole('button', { name: /守謙國際會議中心/ }).click();
  await expect(page.getByRole('heading', { name: '守謙國際會議中心' })).toBeVisible();
  await expect(page.getByRole('link', { name: '在 Google 地圖導航' })).toHaveAttribute('href', /google\.com\/maps/);
});

test('AI assistant cites an official document', async ({ page }) => {
  await page.goto('/assistant');
  await page.getByRole('button', { name: '淡江病假怎麼請？' }).click();
  await expect(page.getByRole('link', { name: /淡江大學學生請假規則/ })).toBeVisible();
});

test('dark mode toggle persists across reloads', async ({ page }) => {
  await page.goto('/me');
  await page.getByRole('radio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
