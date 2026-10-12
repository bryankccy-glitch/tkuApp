import i18n from '@/i18n';
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

const locale = () => (i18n.language === 'en' ? 'en-US' : 'zh-TW');
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(kind: 'long' | 'short' | 'time'): Intl.DateTimeFormat {
  const key = `${locale()}|${kind}`;
  let f = fmtCache.get(key);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions =
      kind === 'long' ? { month: 'long', day: 'numeric', weekday: 'long' }
      : kind === 'short' ? { month: 'numeric', day: 'numeric', weekday: 'short' }
      : { hour: '2-digit', minute: '2-digit', hour12: false };
    f = new Intl.DateTimeFormat(locale(), opts);
    fmtCache.set(key, f);
  }
  return f;
}

export const formatDateLong = (d: Date) => fmt('long').format(d);
export const formatDateShort = (d: Date) => fmt('short').format(d);
export const formatTime = (d: Date) => fmt('time').format(d);

/** Human countdown: 「12 分鐘後」/ "in 12 min". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return i18n.t('time.started');
  const min = Math.round(ms / 60000);
  if (min < 1) return i18n.t('time.soon');
  if (min < 60) return i18n.t('time.inMinutes', { count: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? i18n.t('time.inHoursMinutes', { h, m }) : i18n.t('time.inHours', { count: h });
  return i18n.t('time.inDays', { count: Math.round(h / 24) });
}

export function formatDue(dueIso: string, now: Date): string {
  const due = new Date(dueIso);
  const diff = due.getTime() - now.getTime();
  const dayDiff = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86400000);
  const t = formatTime(due);
  if (diff < 0) {
    const d = Math.abs(dayDiff);
    return d === 0 ? i18n.t('time.overdueToday', { time: t }) : i18n.t('time.overdueDays', { count: d });
  }
  if (dayDiff === 0) return i18n.t('time.today', { time: t });
  if (dayDiff === 1) return i18n.t('time.tomorrow', { time: t });
  if (dayDiff < 7) return `${formatDateShort(due)} ${t}`;
  return `${formatDateShort(due)}`;
}
