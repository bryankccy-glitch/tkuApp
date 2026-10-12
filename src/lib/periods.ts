/**
 * 淡江大學日間部上課節次。
 * 來源：淡江大學德文系 113-1 課程表（tfgx.tku.edu.tw）所列節次時間，1–12 節。
 * 夜間 13、14 節尚未查核，故不列入；使用者可直接輸入自訂時間。
 */
export interface Period {
  no: number;
  start: string;
  end: string;
}

export const TKU_PERIODS: Period[] = [
  { no: 1, start: '08:10', end: '09:00' },
  { no: 2, start: '09:10', end: '10:00' },
  { no: 3, start: '10:10', end: '11:00' },
  { no: 4, start: '11:10', end: '12:00' },
  { no: 5, start: '12:10', end: '13:00' },
  { no: 6, start: '13:10', end: '14:00' },
  { no: 7, start: '14:10', end: '15:00' },
  { no: 8, start: '15:10', end: '16:00' },
  { no: 9, start: '16:10', end: '17:00' },
  { no: 10, start: '17:10', end: '18:00' },
  { no: 11, start: '18:10', end: '19:00' },
  { no: 12, start: '19:10', end: '20:00' },
];

export const PERIOD_SOURCE = {
  name: '淡江大學德文系 113-1 課程表（節次時間）',
  url: 'https://www.tfgx.tku.edu.tw/tfgx/wp-content/uploads/2024/09/113-1.pdf',
};

export function periodRangeToTimes(from: number, to: number): { startTime: string; endTime: string } | null {
  const a = TKU_PERIODS.find((p) => p.no === from);
  const b = TKU_PERIODS.find((p) => p.no === to);
  if (!a || !b || b.no < a.no) return null;
  return { startTime: a.start, endTime: b.end };
}

/** Returns the period numbers covered by a time range (for display like 「第 3–4 節」). */
export function timesToPeriods(startTime: string, endTime: string): number[] {
  return TKU_PERIODS.filter((p) => p.start >= startTime && p.end <= endTime).map((p) => p.no);
}

export function formatPeriods(nos: number[]): string {
  if (nos.length === 0) return '';
  const first = nos[0];
  const last = nos[nos.length - 1];
  return first === last ? `第 ${first} 節` : `第 ${first}–${last} 節`;
}
