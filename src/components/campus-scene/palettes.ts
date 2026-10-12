import type { DayPhase, Palette, RGB, SceneWeather } from './sceneTypes';

const h = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const DAY: Palette = {
  skyTop: h('#3E7FD6'), skyMid: h('#6FA8E8'), skyLow: h('#B9DAF5'),
  sun: h('#FFF4C2'), sunGlow: h('#FFE48A'), moon: h('#F4F1DE'), star: h('#FFFFFF'),
  cloudLight: h('#FFFFFF'), cloudShade: h('#D3E2F2'),
  mountainFar: h('#86A7C4'), mountainNear: h('#5F8A7A'),
  townDark: h('#9DAFC0'), townLight: h('#D7E1EA'), windowLit: h('#FFE7A0'),
  river: h('#4D8FC4'), riverDeep: h('#326C9E'), riverShine: h('#CFE8FA'),
  pylon: h('#F2F2EE'), pylonShade: h('#B9BDC4'), deck: h('#E8E6E1'), deckShade: h('#8E949C'), cable: h('#DADCE0'), bridgeLight: h('#FFE9A8'),
  grassLight: h('#7DBA4E'), grassDark: h('#4F8F3A'), treeLight: h('#4E9A3E'), treeDark: h('#2F6B33'), trunk: h('#6B4A2E'),
  roofRed: h('#B3262D'), wall: h('#F3EEE4'),
  rain: h('#DCE8F5'), bird: h('#2B2F36'), haze: h('#E6EEF5'),
};

const DAWN: Palette = {
  ...DAY,
  skyTop: h('#4B6CB7'), skyMid: h('#C792B5'), skyLow: h('#F6C59B'),
  sun: h('#FFE0A3'), sunGlow: h('#FFB98A'), cloudLight: h('#FCE3D8'), cloudShade: h('#C9A6B8'),
  mountainFar: h('#8A86A8'), mountainNear: h('#5D6E7A'), townDark: h('#8B8EA6'), townLight: h('#C9C4D2'),
  river: h('#7A8FB8'), riverDeep: h('#566A95'), riverShine: h('#FAD3B8'),
  pylon: h('#F7E9DE'), pylonShade: h('#B6A5A8'), deck: h('#EADCD3'),
  grassLight: h('#6EA55A'), grassDark: h('#467A44'), treeLight: h('#457F45'), treeDark: h('#2C5634'),
};

const DUSK: Palette = {
  ...DAY,
  skyTop: h('#3A2E6E'), skyMid: h('#C4507A'), skyLow: h('#F59A4A'),
  sun: h('#FFD27A'), sunGlow: h('#FF8A4C'), cloudLight: h('#FFB7A0'), cloudShade: h('#9C5A86'),
  mountainFar: h('#6B4A78'), mountainNear: h('#3D2F4F'), townDark: h('#4A3656'), townLight: h('#7E5A78'), windowLit: h('#FFD27A'),
  river: h('#B5627A'), riverDeep: h('#5E3A66'), riverShine: h('#FFC67A'),
  pylon: h('#2E2440'), pylonShade: h('#211A30'), deck: h('#2E2440'), deckShade: h('#1D1629'), cable: h('#4E3F63'), bridgeLight: h('#FFD98A'),
  grassLight: h('#55724A'), grassDark: h('#36503A'), treeLight: h('#3A5A3C'), treeDark: h('#24392A'), trunk: h('#3E2C24'),
  roofRed: h('#8E1C22'), wall: h('#C9A7A0'), bird: h('#22182E'), haze: h('#E6A08A'),
};

const NIGHT: Palette = {
  ...DAY,
  skyTop: h('#070B1E'), skyMid: h('#111A3A'), skyLow: h('#25305A'),
  sun: h('#F4F1DE'), sunGlow: h('#3A4470'), moon: h('#F4F1DE'), star: h('#F8F4E3'),
  cloudLight: h('#3A4468'), cloudShade: h('#232A48'),
  mountainFar: h('#1B2244'), mountainNear: h('#121731'), townDark: h('#151A33'), townLight: h('#222A4B'), windowLit: h('#FFD27A'),
  river: h('#121C3D'), riverDeep: h('#0A1128'), riverShine: h('#FFD98A'),
  pylon: h('#C9CEDC'), pylonShade: h('#7C849C'), deck: h('#3B4362'), deckShade: h('#20263F'), cable: h('#7C86A8'), bridgeLight: h('#FFE4A0'),
  grassLight: h('#1F3326'), grassDark: h('#142218'), treeLight: h('#1A2E22'), treeDark: h('#0F1C15'), trunk: h('#1C1612'),
  roofRed: h('#5E1418'), wall: h('#3A3540'), rain: h('#8090B8'), bird: h('#0B0E1A'), haze: h('#2A3358'),
};

export const PHASE_PALETTES: Record<DayPhase, Palette> = {
  dawn: DAWN,
  morning: DAY,
  noon: DAY,
  afternoon: { ...DAY, skyTop: h('#3A76CC'), skyLow: h('#CFE3F2'), sun: h('#FFF0B3') },
  dusk: DUSK,
  night: NIGHT,
};

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const out = {} as Record<keyof Palette, RGB>;
  (Object.keys(a) as (keyof Palette)[]).forEach((k) => (out[k] = mix(a[k], b[k], t)));
  return out as Palette;
}

/** Weather mutes the palette: cloudy greys the sky, rain darkens and lowers contrast. */
export function weatherPalette(base: Palette, weather: SceneWeather, phase: DayPhase): Palette {
  if (weather === 'sunny') return base;
  const night = phase === 'night';
  const grey: RGB = night ? h('#151A2A') : weather === 'rainy' ? h('#5F6B78') : h('#9AA4AF');
  const amount = weather === 'rainy' ? 0.62 : 0.45;
  const sky = (c: RGB) => mix(c, grey, amount);
  const land = (c: RGB) => mix(c, grey, amount * 0.45);
  return {
    ...base,
    skyTop: sky(base.skyTop), skyMid: sky(base.skyMid), skyLow: sky(base.skyLow),
    sunGlow: sky(base.sunGlow),
    cloudLight: mix(base.cloudLight, night ? h('#3C4560') : h('#E3E7EC'), 0.6),
    cloudShade: mix(base.cloudShade, night ? h('#252B40') : weather === 'rainy' ? h('#7D8792') : h('#AEB7C1'), 0.7),
    mountainFar: sky(base.mountainFar), mountainNear: land(base.mountainNear),
    townDark: land(base.townDark), townLight: land(base.townLight),
    river: land(base.river), riverDeep: land(base.riverDeep), riverShine: mix(base.riverShine, grey, amount * 0.7),
    grassLight: land(base.grassLight), grassDark: land(base.grassDark), treeLight: land(base.treeLight), treeDark: land(base.treeDark),
    haze: mix(base.haze, grey, 0.5),
  };
}

export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
