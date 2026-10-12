export type DayPhase = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';
export type SceneWeather = 'sunny' | 'cloudy' | 'rainy';
/** The five named scenes; time (sunset/night) and weather combine, e.g. a rainy night. */
export type SceneKind = 'sunny' | 'cloudy' | 'rainy' | 'sunset' | 'night';
export type GreetingKey = 'morning' | 'noon' | 'afternoon' | 'evening';

export interface SceneState {
  phase: DayPhase;
  weather: SceneWeather;
  kind: SceneKind;
  /** 0–1, drives drop count */
  rainIntensity: number;
  /** 0–1 */
  cloudCover: number;
  fog: boolean;
  /** km/h, drives cloud drift */
  windSpeed: number;
  /** 0 at sunrise → 1 at sunset; <0 before sunrise, >1 after sunset */
  sunProgress: number;
  /** 0–1, building & bridge lights */
  lights: number;
}

/** RGB triplets. Limited palette per scene, blended during transitions. */
export interface Palette {
  skyTop: RGB;
  skyMid: RGB;
  skyLow: RGB;
  sun: RGB;
  sunGlow: RGB;
  moon: RGB;
  star: RGB;
  cloudLight: RGB;
  cloudShade: RGB;
  mountainFar: RGB;
  mountainNear: RGB;
  townDark: RGB;
  townLight: RGB;
  windowLit: RGB;
  river: RGB;
  riverDeep: RGB;
  riverShine: RGB;
  pylon: RGB;
  pylonShade: RGB;
  deck: RGB;
  deckShade: RGB;
  cable: RGB;
  bridgeLight: RGB;
  grassLight: RGB;
  grassDark: RGB;
  treeLight: RGB;
  treeDark: RGB;
  trunk: RGB;
  roofRed: RGB;
  wall: RGB;
  rain: RGB;
  bird: RGB;
  haze: RGB;
}
export type RGB = readonly [number, number, number];
