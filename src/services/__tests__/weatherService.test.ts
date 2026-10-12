import { describe, expect, it, vi } from 'vitest';
import { buildWeatherUrl, conditionFromCode, fetchCampusWeather, isStale, parseWeather, readCachedWeather, WeatherError } from '../weatherService';

export const SAMPLE = {
  utc_offset_seconds: 28800,
  current: {
    time: '2026-10-12T15:45', temperature_2m: 26.4, relative_humidity_2m: 71, apparent_temperature: 28.1, precipitation: 0, rain: 0,
    weather_code: 2, cloud_cover: 42, wind_speed_10m: 11.2, is_day: 1,
  },
  daily: { sunrise: ['2026-10-12T05:52'], sunset: ['2026-10-12T17:30'] },
};

describe('weatherService', () => {
  it('requests every field the spec needs for Tamsui in Asia/Taipei', () => {
    const url = new URL(buildWeatherUrl());
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('timezone')).toBe('Asia/Taipei');
    for (const f of ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation', 'rain', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'is_day']) {
      expect(url.searchParams.get('current')).toContain(f);
    }
    expect(url.searchParams.get('daily')).toBe('sunrise,sunset');
    expect(Number(url.searchParams.get('latitude'))).toBeCloseTo(25.175, 2);
  });

  it('maps WMO codes', () => {
    expect(conditionFromCode(0)).toBe('clear');
    expect(conditionFromCode(3)).toBe('overcast');
    expect(conditionFromCode(45)).toBe('fog');
    expect(conditionFromCode(53)).toBe('drizzle');
    expect(conditionFromCode(63)).toBe('rain');
    expect(conditionFromCode(81)).toBe('showers');
    expect(conditionFromCode(95)).toBe('thunder');
  });

  it('parses local times with the +08:00 offset', () => {
    const w = parseWeather(SAMPLE, new Date('2026-10-12T07:46:00Z'));
    expect(w.temperature).toBe(26.4);
    expect(w.condition).toBe('partly');
    expect(w.sunset).toBe('2026-10-12T17:30:00+08:00');
    expect(new Date(w.sunset).toISOString()).toBe('2026-10-12T09:30:00.000Z');
  });

  it('rejects malformed responses instead of inventing values', () => {
    expect(() => parseWeather({ current: {} })).toThrow();
  });

  it('caches the last valid reading and classifies failures', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE });
    await fetchCampusWeather(ok as unknown as typeof fetch);
    expect(readCachedWeather()?.temperature).toBe(26.4);

    const http = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchCampusWeather(http as unknown as typeof fetch)).rejects.toMatchObject({ kind: 'http' });

    const abort = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(fetchCampusWeather(abort as unknown as typeof fetch)).rejects.toBeInstanceOf(WeatherError);
    await expect(fetchCampusWeather(abort as unknown as typeof fetch)).rejects.toMatchObject({ kind: 'timeout' });

    // still the last valid reading after failures
    expect(readCachedWeather()?.temperature).toBe(26.4);
  });

  it('flags readings older than an hour as stale', () => {
    const w = parseWeather(SAMPLE, new Date('2026-10-12T07:00:00Z'));
    expect(isStale(w, new Date('2026-10-12T07:30:00Z'))).toBe(false);
    expect(isStale(w, new Date('2026-10-12T08:30:00Z'))).toBe(true);
  });
});
