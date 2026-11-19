import type { Weekday } from '@/lib/types';
import { addDays, formatDateShort, startOfDay, weekdayOf } from '@/lib/time';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { t } from '@/i18n/t';

const ZH_DAY: Record<string, Weekday> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
const EN_DAY: Record<string, Weekday> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

/** Explicit dates are local calendar dates; a bare weekday means its next occurrence. */
export function resolveDay(q: string, now: Date): { date: Date; label: string } | null {
  const explicit = q.match(/(?:(\d{4})[-/])?(\d{1,2})[-/](\d{1,2})(?!\d)|(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日號]?/);
  if (explicit) {
    const year = Number(explicit[1] ?? explicit[4] ?? now.getFullYear());
    const month = Number(explicit[2] ?? explicit[5]);
    const day = Number(explicit[3] ?? explicit[6]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { date, label: WEEKDAY_LABELS[weekdayOf(date)] };
  }
  if (/後天|day after tomorrow/i.test(q)) return { date: addDays(now, 2), label: t('ai.day.afterTomorrow') };
  if (/明天|明日|tomorrow/i.test(q)) return { date: addDays(now, 1), label: t('ai.day.tomorrow') };
  if (/昨天|昨日|yesterday/i.test(q)) { const date = addDays(now, -1); return { date, label: formatDateShort(date) }; }
  if (/今天|今日|today/i.test(q)) return { date: now, label: t('ai.day.today') };
  const zh = q.match(/(?:週|星期|禮拜)([一二三四五六日天])/);
  const en = q.toLowerCase().match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/);
  const target = zh ? ZH_DAY[zh[1]!] : en ? EN_DAY[en[1]!] : undefined;
  if (target) {
    const diff = /下(?:週|星期|禮拜)|next\s+(?:week|mon|tue|wed|thu|fri|sat|sun)/i.test(q)
      ? 7 - weekdayOf(now) + target
      : /本週|這週|這星期|這禮拜|this week/i.test(q) ? target - weekdayOf(now) : (target - weekdayOf(now) + 7) % 7;
    return { date: addDays(now, diff), label: WEEKDAY_LABELS[target] };
  }
  return null;
}

export function chineseNumber(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  const digits: Record<string, number> = { 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const [tens, units] = s.split('十');
  return s.includes('十') ? (tens ? digits[tens] ?? 0 : 1) * 10 + (units ? digits[units] ?? 0 : 0) : digits[s] ?? -1;
}

export function resolveClock(q: string): number | null {
  const m = q.match(/(\d{1,2}):([0-5]\d)|((?:二十[一二三]?|十[一二三四五六七八九]?|[零一二兩三四五六七八九]|\d{1,2}))點(半|[零一二兩三四五六七八九十\d]{1,3}分?)?/);
  if (!m) return null;
  let h = m[1] ? Number(m[1]) : chineseNumber(m[3]!);
  const mins = m[2] ? Number(m[2]) : m[4] === '半' ? 30 : m[4] ? chineseNumber(m[4].replace(/分$/, '')) : 0;
  if (/下午|晚上|傍晚|\bpm\b/i.test(q) && h < 12) h += 12;
  if (/中午/.test(q) && h < 11) h += 12;
  if (/凌晨|早上|上午|\bam\b/i.test(q) && h === 12) h = 0;
  return h >= 0 && h < 24 && mins >= 0 && mins < 60 ? h * 60 + mins : null;
}

export function referenceTime(q: string, now: Date): Date {
  const day = resolveDay(q, now);
  const clock = resolveClock(q);
  // 「今天」with no clock time means right now, not today's midnight.
  const isToday = day && startOfDay(day.date).getTime() === startOfDay(now).getTime();
  const date = day && !(isToday && clock === null) ? startOfDay(day.date) : new Date(now);
  if (clock !== null) date.setHours(Math.floor(clock / 60), clock % 60, 0, 0);
  return date;
}
