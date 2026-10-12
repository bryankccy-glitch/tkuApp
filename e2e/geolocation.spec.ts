import { expect, test } from '@playwright/test';

test.describe('校園探索：我的位置', () => {
  test('does not ask for location until the button is pressed, then pins the user on the map', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
    let asked = 0;
    await context.exposeFunction('__geoAsked', () => { asked += 1; });
    await context.addInitScript(() => {
      const real = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = (...args: Parameters<Geolocation['watchPosition']>) => {
        (window as unknown as { __geoAsked: () => void }).__geoAsked();
        return real(...args);
      };
    });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.1752, longitude: 121.4505, accuracy: 25 }); // inside the campus
    const page = await context.newPage();

    await page.goto('/explore');
    await page.waitForLoadState('networkidle');
    expect(asked).toBe(0);
    await expect(page.locator('.me-dot')).toHaveCount(0);

    await page.getByRole('button', { name: '顯示我目前的位置' }).click();
    await expect(page.locator('.me-dot')).toHaveCount(1);
    await expect(page.getByText(/藍點是你目前的位置（誤差約 25 公尺）/)).toBeVisible();
    await expect(page.getByText('位置只在你的手機上使用，不會上傳。')).toBeVisible();
    expect(asked).toBe(1); // only after the tap

    // After moving, pressing again refreshes the same pin instead of adding another.
    await context.setGeolocation({ latitude: 25.1760, longitude: 121.4500, accuracy: 10 });
    await page.getByRole('button', { name: '顯示我目前的位置' }).click();
    await expect(page.getByText(/誤差約 10 公尺/)).toBeVisible();
    await expect(page.locator('.me-dot')).toHaveCount(1);
    await context.close();
  });

  test('explains how to fix it when permission is denied', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei', permissions: [] });
    const page = await context.newPage();
    await page.goto('/explore');
    await page.getByRole('button', { name: '顯示我目前的位置' }).click();
    await expect(page.getByRole('alert')).toContainText('沒有定位權限');
    await expect(page.locator('.me-dot')).toHaveCount(0);
    await context.close();
  });

  test('says how far away the campus is when the user is elsewhere', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.0478, longitude: 121.5170, accuracy: 30 }); // Taipei Main Station
    const page = await context.newPage();
    await page.goto('/explore');
    await page.getByRole('button', { name: '顯示我目前的位置' }).click();
    await expect(page.getByText(/你目前距離淡水校園約 1\d\.\d 公里/)).toBeVisible();
    await expect(page.locator('.me-dot')).toHaveCount(1);
    await context.close();
  });
});
