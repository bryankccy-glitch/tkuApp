import { describe, expect, it } from 'vitest';
import { buildScene, greetingKey, phaseAt, sceneKind, sceneWeatherOf } from '../SceneController';
import { parseWeather } from '@/services/weatherService';
import { sunTimes } from '@/lib/solar';
import { mixPalette, PHASE_PALETTES, weatherPalette } from '../palettes';

const tpe = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00+08:00`);
const sunrise = tpe('05:52');
const sunset = tpe('17:30');

describe('time of day', () => {
  it('uses real sunrise/sunset, not fixed hours', () => {
    expect(phaseAt(tpe('04:30'), sunrise, sunset)).toBe('night');
    expect(phaseAt(tpe('06:10'), sunrise, sunset)).toBe('dawn');
    expect(phaseAt(tpe('09:00'), sunrise, sunset)).toBe('morning');
    expect(phaseAt(tpe('12:15'), sunrise, sunset)).toBe('noon');
    expect(phaseAt(tpe('15:00'), sunrise, sunset)).toBe('afternoon');
    expect(phaseAt(tpe('17:00'), sunrise, sunset)).toBe('dusk');
    expect(phaseAt(tpe('18:20'), sunrise, sunset)).toBe('night');
    // a June sunset at 18:48 means 18:20 is still dusk
    expect(phaseAt(new Date('2026-06-21T18:20:00+08:00'), new Date('2026-06-21T05:05:00+08:00'), new Date('2026-06-21T18:48:00+08:00'))).toBe('dusk');
  });

  it('greets per spec', () => {
    expect(greetingKey('morning', tpe('08:00'), sunset)).toBe('morning');
    expect(greetingKey('noon', tpe('12:00'), sunset)).toBe('noon');
    expect(greetingKey('afternoon', tpe('15:00'), sunset)).toBe('afternoon');
    expect(greetingKey('dusk', tpe('17:50'), sunset)).toBe('evening');
    expect(greetingKey('night', tpe('22:00'), sunset)).toBe('evening');
  });

  it('local solar fallback is within minutes of the API for Tamsui', () => {
    const { sunrise: r, sunset: s } = sunTimes(tpe('12:00'), 25.175, 121.449);
    expect(Math.abs(r.getTime() - sunrise.getTime())).toBeLessThan(6 * 60_000);
    expect(Math.abs(s.getTime() - sunset.getTime())).toBeLessThan(6 * 60_000);
  });
});

describe('scene selection', () => {
  const base = {
    utc_offset_seconds: 28800,
    current: { time: '2026-10-12T15:00', temperature_2m: 24, relative_humidity_2m: 80, apparent_temperature: 25, precipitation: 0, rain: 0, weather_code: 0, cloud_cover: 10, wind_speed_10m: 5, is_day: 1 },
    daily: { sunrise: ['2026-10-12T05:52'], sunset: ['2026-10-12T17:30'] },
  };
  const w = (code: number, extra: Partial<typeof base.current> = {}) => parseWeather({ ...base, current: { ...base.current, weather_code: code, ...extra } });

  it('combines time and weather (rainy night stays a night scene with rain)', () => {
    const s = buildScene(tpe('21:00'), sunrise, sunset, w(63, { precipitation: 6 }));
    expect(s.kind).toBe('night');
    expect(s.weather).toBe('rainy');
    expect(s.rainIntensity).toBe(1);
    expect(s.lights).toBe(1);
  });

  it('sunset scene at dusk unless raining', () => {
    expect(sceneKind('dusk', 'sunny')).toBe('sunset');
    expect(sceneKind('dusk', 'cloudy')).toBe('sunset');
    expect(sceneKind('dusk', 'rainy')).toBe('rainy');
  });

  it('cloud cover decides partly cloudy', () => {
    expect(sceneWeatherOf(w(2, { cloud_cover: 30 })).weather).toBe('sunny');
    expect(sceneWeatherOf(w(2, { cloud_cover: 80 })).weather).toBe('cloudy');
    expect(sceneWeatherOf(w(45)).fog).toBe(true);
    expect(sceneWeatherOf(null).weather).toBe('sunny'); // fallback scene when the API is down
  });

  it('palettes blend smoothly and weather mutes them', () => {
    const half = mixPalette(PHASE_PALETTES.afternoon, PHASE_PALETTES.night, 0.5);
    expect(half.skyTop[2]).toBeLessThan(PHASE_PALETTES.afternoon.skyTop[2]);
    const rainy = weatherPalette(PHASE_PALETTES.noon, 'rainy', 'noon');
    expect(rainy.skyTop).not.toEqual(PHASE_PALETTES.noon.skyTop);
  });
});

import { sameTaipeiDay, taipeiMinutes } from '@/lib/taipei';
describe('campus time helpers', () => {
  it('use Asia/Taipei regardless of the device timezone', () => {
    expect(taipeiMinutes(new Date('2026-10-12T04:15:00Z'))).toBe(12 * 60 + 15);
    expect(sameTaipeiDay(new Date('2026-10-12T16:30:00Z'), new Date('2026-10-13T01:00:00+08:00'))).toBe(true);
  });
});
