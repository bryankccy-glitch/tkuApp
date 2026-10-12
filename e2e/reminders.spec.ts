import { expect, test } from '@playwright/test';

test('task reminder fires as a system notification at the chosen time', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await page.clock.install();
  await page.addInitScript(() => {
    const shown: string[] = [];
    (window as unknown as { __shown: string[] }).__shown = shown;
    // capture instead of displaying
    ServiceWorkerRegistration.prototype.showNotification = async function (title: string) { shown.push(title); };
    const N = function (this: unknown, title: string) { shown.push(title); } as unknown as typeof Notification;
    Object.defineProperty(N, 'permission', { get: () => 'granted' });
    (N as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => 'granted';
    window.Notification = N;
  });

  // enable reminders
  await page.goto('/me');
  await page.getByRole('switch', { name: '開啟提醒' }).click();
  await expect(page.getByText('已開啟上課與截止提醒')).toBeVisible();

  // add a task due in 61 minutes with a 1-hour reminder
  await page.goto('/tasks?add=1');
  const dialog = page.getByRole('dialog', { name: '新增作業或考試' });
  await dialog.getByLabel('標題').fill('期末報告');
  const due = await page.evaluate(() => {
    const d = new Date(Date.now() + 61 * 60_000);
    const p = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
  });
  await dialog.getByLabel('截止日期').fill(due.date);
  await dialog.getByLabel('截止時間').fill(due.time);
  await dialog.getByLabel('提醒').selectOption('60');
  await dialog.getByRole('button', { name: '新增' }).click();
  await expect(page.getByText('已新增「期末報告」')).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __shown: string[] }).__shown)).toEqual([]);
  await page.clock.fastForward('02:00');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shown: string[] }).__shown)).toEqual(['作業即將截止：期末報告']);
});
