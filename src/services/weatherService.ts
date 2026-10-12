/**
 * Weather for the Tamsui campus from Open-Meteo (https://open-meteo.com, free, no API key).
 * UI code must go through useCampusWeather; this module only fetches, parses and caches.
 */
import { CAMPUS_CENTER } from '@/data/places';

export type WeatherCondition = 'clear' | 'mostlyClear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'thunder' | 'snow';

export interface CampusWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number; // mm (last hour)
  rain: number; // mm
  weatherCode: number;
  condition: WeatherCondition;
  cloudCover: number; // %
  windSpeed: number; // km/h
  isDay: boolean;
  sunrise: string; // ISO with offset
  sunset: string;
  observedAt: string; // ISO with offset (API "current.time")
  fetchedAt: string; // ISO, when we received it
}

/**
 * 淡江大學淡水校園中心（Wikipedia: 25.175, 121.449）。
 * 需求文件建議的 25.174, 121.443 位於校園西側約 600 m，屬同一個 Open-Meteo 網格範圍。
 */
export const WEATHER_LOCATION = { latitude: CAMPUS_CENTER.lat, longitude: CAMPUS_CENTER.lng, timezone: 'Asia/Taipei' } as const;
export const WEATHER_SOURCE = { name: 'Open-Meteo', url: 'https://open-meteo.com/' };
export const REFRESH_MS = 20 * 60_000;
export const STALE_AFTER_MS = 60 * 60_000;
const TIMEOUT_MS = 8_000;
const CACHE_KEY = 'tku.weather.v1';

/** WMO weather interpretation codes → condition. */
export function conditionFromCode(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostlyClear';
  if (code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'showers';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'partly';
}

export function buildWeatherUrl(): string {
  const p = new URLSearchParams({
    latitude: String(WEATHER_LOCATION.latitude),
    longitude: String(WEATHER_LOCATION.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,is_day',
    daily: 'sunrise,sunset',
    timezone: WEATHER_LOCATION.timezone,
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

interface OpenMeteoResponse {
  utc_offset_seconds?: number;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    weather_code: number;
    cloud_cover: number;
    wind_speed_10m: number;
    is_day: number;
  };
  daily?: { sunrise: string[]; sunset: string[] };
}

/** Open-Meteo returns local times without offset; attach the location's offset. */
function withOffset(local: string, offsetSeconds: number): string {
  const sign = offsetSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(offsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${local.length === 16 ? `${local}:00` : local}${sign}${hh}:${mm}`;
}

export function parseWeather(json: unknown, fetchedAt = new Date()): CampusWeather {
  const r = json as OpenMeteoResponse;
  const c = r.current;
  if (!c || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number' || !r.daily?.sunrise?.[0] || !r.daily.sunset?.[0]) {
    throw new Error('weather: unexpected response shape');
  }
  const off = r.utc_offset_seconds ?? 8 * 3600;
  return {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    precipitation: c.precipitation ?? 0,
    rain: c.rain ?? 0,
    weatherCode: c.weather_code,
    condition: conditionFromCode(c.weather_code),
    cloudCover: c.cloud_cover ?? 0,
    windSpeed: c.wind_speed_10m ?? 0,
    isDay: c.is_day === 1,
    sunrise: withOffset(r.daily.sunrise[0], off),
    sunset: withOffset(r.daily.sunset[0], off),
    observedAt: withOffset(c.time, off),
    fetchedAt: fetchedAt.toISOString(),
  };
}

export type WeatherErrorKind = 'offline' | 'timeout' | 'http' | 'invalid';
export class WeatherError extends Error {
  constructor(public kind: WeatherErrorKind, message: string) {
    super(message);
  }
}

export async function fetchCampusWeather(fetchImpl: typeof fetch = fetch): Promise<CampusWeather> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new WeatherError('offline', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(buildWeatherUrl(), { signal: ctrl.signal });
    if (!res.ok) throw new WeatherError('http', `HTTP ${res.status}`);
    const data = parseWeather(await res.json());
    writeCachedWeather(data);
    return data;
  } catch (e) {
    if (e instanceof WeatherError) throw e;
    if ((e as Error).name === 'AbortError') throw new WeatherError('timeout', 'timeout');
    if (e instanceof Error && e.message.startsWith('weather:')) throw new WeatherError('invalid', e.message);
    throw new WeatherError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'http', String(e));
  } finally {
    clearTimeout(timer);
  }
}

export function readCachedWeather(): CampusWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CampusWeather) : null;
  } catch {
    return null;
  }
}

function writeCachedWeather(w: CampusWeather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

export function isStale(w: CampusWeather, now = new Date()): boolean {
  return now.getTime() - new Date(w.fetchedAt).getTime() > STALE_AFTER_MS;
}
