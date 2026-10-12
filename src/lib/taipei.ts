/** Taiwan has no DST: Asia/Taipei is always UTC+8. Campus-time helpers independent of the device timezone. */
const OFFSET_MS = 8 * 3600_000;

/** Minutes since midnight in Asia/Taipei. */
export function taipeiMinutes(d: Date): number {
  const t = new Date(d.getTime() + OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

export function taipeiHours(d: Date): number {
  return Math.floor(taipeiMinutes(d) / 60);
}

/** Calendar date in Asia/Taipei as { y, m (0-based), d } */
export function taipeiDate(d: Date): { y: number; m: number; d: number } {
  const t = new Date(d.getTime() + OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

export function sameTaipeiDay(a: Date, b: Date): boolean {
  const x = taipeiDate(a), y = taipeiDate(b);
  return x.y === y.y && x.m === y.m && x.d === y.d;
}
