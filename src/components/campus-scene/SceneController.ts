import type { CampusWeather } from '@/services/weatherService';
import type { DayPhase, GreetingKey, SceneKind, SceneState, SceneWeather } from './sceneTypes';

export type { DayPhase } from './sceneTypes';

const MIN = 60_000;

/** Time-of-day phase from real sunrise/sunset (never a fixed 18:00 sunset). */
export function phaseAt(now: Date, sunrise: Date, sunset: Date): DayPhase {
  const t = now.getTime();
  if (t < sunrise.getTime() - 40 * MIN) return 'night';
  if (t < sunrise.getTime() + 60 * MIN) return 'dawn';
  const mins = now.getHours() * 60 + now.getMinutes();
  if (t < sunset.getTime() - 70 * MIN) {
    if (mins < 11 * 60) return 'morning';
    if (mins < 13 * 60 + 30) return 'noon';
    return 'afternoon';
  }
  if (t < sunset.getTime() + 35 * MIN) return 'dusk';
  return 'night';
}

export function greetingKey(phase: DayPhase, now: Date, sunset: Date): GreetingKey {
  switch (phase) {
    case 'dawn':
    case 'morning':
      return 'morning';
    case 'noon':
      return 'noon';
    case 'afternoon':
      return 'afternoon';
    case 'dusk':
      return now < sunset ? 'afternoon' : 'evening';
    case 'night':
      return now.getHours() >= 4 && now.getHours() < 12 ? 'morning' : 'evening';
  }
}

export function sceneWeatherOf(w: CampusWeather | null): { weather: SceneWeather; rainIntensity: number; fog: boolean } {
  if (!w) return { weather: 'sunny', rainIntensity: 0, fog: false };
  switch (w.condition) {
    case 'clear':
    case 'mostlyClear':
      return { weather: 'sunny', rainIntensity: 0, fog: false };
    case 'partly':
      return { weather: w.cloudCover >= 60 ? 'cloudy' : 'sunny', rainIntensity: 0, fog: false };
    case 'overcast':
      return { weather: 'cloudy', rainIntensity: 0, fog: false };
    case 'fog':
      return { weather: 'cloudy', rainIntensity: 0, fog: true };
    case 'drizzle':
      return { weather: 'rainy', rainIntensity: 0.25, fog: false };
    case 'rain':
    case 'showers':
    case 'snow':
      return { weather: 'rainy', rainIntensity: Math.min(1, Math.max(0.35, w.precipitation / 4)), fog: false };
    case 'thunder':
      return { weather: 'rainy', rainIntensity: 1, fog: false };
  }
}

export function sceneKind(phase: DayPhase, weather: SceneWeather): SceneKind {
  if (phase === 'night') return 'night';
  if (phase === 'dusk' && weather !== 'rainy') return 'sunset';
  return weather;
}

export function buildScene(now: Date, sunrise: Date, sunset: Date, w: CampusWeather | null): SceneState {
  const phase = phaseAt(now, sunrise, sunset);
  const sw = sceneWeatherOf(w);
  const span = sunset.getTime() - sunrise.getTime();
  const sunProgress = (now.getTime() - sunrise.getTime()) / span;
  // Lights fade in from 30 min before sunset, full after dusk; off after sunrise.
  const toSunset = (sunset.getTime() - now.getTime()) / MIN;
  const lights = phase === 'night' ? 1 : phase === 'dusk' ? Math.min(1, Math.max(0, (30 - toSunset) / 60)) : sw.weather === 'rainy' ? 0.25 : 0;
  const cloudCover = w ? w.cloudCover / 100 : 0.25;
  return {
    phase,
    weather: sw.weather,
    kind: sceneKind(phase, sw.weather),
    rainIntensity: sw.rainIntensity,
    fog: sw.fog,
    cloudCover: sw.weather === 'rainy' ? Math.max(cloudCover, 0.85) : sw.weather === 'cloudy' ? Math.max(cloudCover, 0.6) : Math.min(cloudCover, 0.45),
    windSpeed: w?.windSpeed ?? 8,
    sunProgress,
    lights,
  };
}
