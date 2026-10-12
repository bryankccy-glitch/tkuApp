import type { Weekday } from './types';

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** JS getDay (0=Sun) → Weekday (1=Mon … 7=Sun). */
export function weekdayOf(d: Date): Weekday {
  const js = d.getDay();
  return (js === 0 ? 7 : js) as Weekday;
}

export function nowHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday 00:00 of d's week. */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -(weekdayOf(d) - 1));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Combine a YYYY-MM-DD and HH:mm in local time to an ISO string. */
export function combineLocal(date: string, time: string): string {
  const [y, mo, da] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y ?? 1970, (mo ?? 1) - 1, da ?? 1, h ?? 0, mi ?? 0).toISOString();
}

const dateFmt = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
const shortFmt = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

export const formatDateLong = (d: Date) => dateFmt.format(d);
export const formatDateShort = (d: Date) => shortFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);

/** Human countdown in zh-TW: 「12 分鐘後」「1 小時 5 分後」「3 天後」. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '已開始';
  const min = Math.round(ms / 60000);
  if (min < 1) return '即將開始';
  if (min < 60) return `${min} 分鐘後`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} 小時 ${m} 分後` : `${h} 小時後`;
  const days = Math.round(h / 24);
  return `${days} 天後`;
}

export function formatDue(dueIso: string, now: Date): string {
  const due = new Date(dueIso);
  const diff = due.getTime() - now.getTime();
  const dayDiff = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86400000);
  const t = formatTime(due);
  if (diff < 0) {
    const d = Math.abs(dayDiff);
    return d === 0 ? `已逾期（今天 ${t}）` : `已逾期 ${d} 天`;
  }
  if (dayDiff === 0) return `今天 ${t}`;
  if (dayDiff === 1) return `明天 ${t}`;
  if (dayDiff < 7) return `${formatDateShort(due)} ${t}`;
  return `${formatDateShort(due)}`;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '午後好';
  return '晚安';
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export function dayPhase(d: Date): DayPhase {
  const h = d.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'dusk';
  return 'night';
}
