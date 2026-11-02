import { expect, test } from '@playwright/test';

const SAMPLE = {
  utc_offset_seconds: 28800,
  current: { time: '2026-10-12T15:45', temperature_2m: 26.4, relative_humidity_2m: 71, apparent_temperature: 28.1, precipitation: 0, rain: 0, weather_code: 2, cloud_cover: 42, wind_speed_10m: 11.2, is_day: 1 },
  daily: { sunrise: ['2026-10-12T05:52'], sunset: ['2026-10-12T17:30'] },
};

test('hero shows live Tamsui weather from Open-Meteo', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: SAMPLE }));
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="hero-greeting"]');
  await expect(hero.getByText('26°')).toBeVisible();
  await expect(hero.getByText('多雲時晴')).toBeVisible();
  await expect(hero.getByText('體感 28°')).toBeVisible();
  await expect(hero.getByRole('link', { name: '天氣資料：Open-Meteo' })).toHaveAttribute('href', 'https://open-meteo.com/');
});

test('weather API failure shows a clear fallback, never an invented temperature', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) => r.abort());
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="hero-greeting"]');
  await expect(hero.getByText('暫時無法取得天氣')).toBeVisible({ timeout: 20_000 });
  await expect(hero.getByText(/\d+°/)).toHaveCount(0);
});

test('pixel scene renders real pixels and animates', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: SAMPLE }));
  await page.goto('/?scene=night,rainy');
  const scene = page.locator('[role="img"][data-scene]');
  await expect(scene).toHaveAttribute('data-scene', 'night');
  await expect(scene).toHaveAttribute('data-animating', 'true');
  const stats = async () =>
    page.evaluate(() => {
      const c = document.querySelector('[data-scene] canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      const colors = new Set<number>();
      for (let i = 0; i < d.length; i += 4) {
        sum += d[i]! + d[i + 1]! + d[i + 2]!;
        colors.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      }
      return { w: c.width, h: c.height, sum, colors: colors.size, style: getComputedStyle(c).imageRendering };
    });
  const a = await stats();
  expect(a.w).toBeLessThan(300); // genuinely low-resolution art
  expect(a.style).toBe('pixelated');
  expect(a.colors).toBeGreaterThan(12);
  expect(a.colors).toBeLessThan(400); // limited palette, not a photo
  await page.waitForTimeout(700);
  const b = await stats();
  expect(b.sum).not.toBe(a.sum); // rain / water / lights moved
});

test('reduced motion renders a still frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?scene=sunset');
  await expect(page.locator('[role="img"][data-scene]')).toHaveAttribute('data-animating', 'false');
});

test('greeting and weather switch to English', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: SAMPLE }));
  await page.goto('/me');
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en'); // the language loads on demand
  await page.goto('/');
  const hero = page.locator('section[aria-labelledby="hero-greeting"]');
  await expect(hero.getByText('Tamsui', { exact: true })).toBeVisible();
  await expect(hero.getByText('Partly cloudy')).toBeVisible();
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(/^Good (morning|day|afternoon|evening), /);
  await expect(page.getByRole('link', { name: 'Find a Classroom' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('quick actions navigate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '找教室' }).click();
  await expect(page).toHaveURL(/\/explore$/);
});
