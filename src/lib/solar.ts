import { taipeiDate } from './taipei';

/**
 * Sunrise / sunset for a given date and location (NOAA simplified algorithm).
 * Used as an offline fallback when the weather API has no sunrise/sunset yet.
 * Accuracy is within a few minutes — enough to pick a scene, not for navigation.
 */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function sunTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date } {
  // Day of year for the calendar date in Asia/Taipei (the campus), independent of the device timezone
  const { y, m, d } = taipeiDate(date);
  const start = Date.UTC(y, 0, 0);
  const today = Date.UTC(y, m, d);
  const n = Math.round((today - start) / 86400000);
  const gamma = ((2 * Math.PI) / 365) * (n - 1);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const ha = deg(Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl)));
  const riseUtcMin = 720 - 4 * (lng + ha) - eqTime;
  const setUtcMin = 720 - 4 * (lng - ha) - eqTime;
  return { sunrise: new Date(today + riseUtcMin * 60000), sunset: new Date(today + setUtcMin * 60000) };
}
