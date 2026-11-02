import type { CampusEvent, Course, Semester, Task, Weekday } from '@/lib/types';
import { findNextClass, occurrencesOn } from '@/lib/schedule';
import { addDays, formatDateLong, formatDateShort, formatDue, formatTime, fromMinutes, toMinutes, weekdayOf, startOfDay } from '@/lib/time';
import { filterTasks, upcomingExams } from '@/lib/tasks';
import { TASK_KIND_LABELS, WEEKDAY_LABELS, EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatPeriods, timesToPeriods, PERIOD_SOURCE, TKU_PERIODS } from '@/lib/periods';
import { CAMPUS_PLACES, buildingFromRoom, mapsSearchUrl, type CampusPlace } from '@/data/places';
import { OFFICIAL_SOURCES } from '@/data/sources';
import { t } from '@/i18n/t';
import { isChinese } from '@/i18n';
import type { SourceRef } from './types';

/**
 * 本機校園助理（不需 API Key）：
 * 只根據使用者自己的課表/待辦、已查核的建築代碼與官方文件清單回答。
 * 不會生成校規內容；找不到可靠資料時明確說明。
 * Reads Chinese and English questions; `withLanguage` picks the language of the answer.
 */
export interface EngineInput {
  question: string;
  courses: Course[];
  tasks: Task[];
  events: CampusEvent[] | null;
  now: Date;
  /** Current semester, for 「第幾週」. */
  semester?: Semester | null;
}
export interface EngineAnswer {
  content: string;
  sources: SourceRef[];
}

const personalSchedule = (): SourceRef => ({ title: t('ai.src.schedule'), kind: 'personal' });
const personalTasks = (): SourceRef => ({ title: t('ai.src.tasks'), kind: 'personal' });

// Simplified → Traditional for the characters the patterns below look for, so 简体 questions work too.
const S2T: Record<string, string> = Object.fromEntries([...'课节几点里这试业办报讲奖学赛实习楼馆么时间后结东门还没吗现开帮图书请规则选补证费厅样怎为个们说对边从网络经济资计设统数据题线总'].map((c, i) => [c, '課節幾點裡這試業辦報講獎學賽實習樓館麼時間後結東門還沒嗎現開幫圖書請規則選補證費廳樣怎為個們說對邊從網絡經濟資計設統數據題線總'[i]!]));
export const SIMPLIFIED_CHARS = new Set(Object.keys(S2T));
export function normalizeQuestion(q: string): string {
  return [...q.normalize('NFKC')].map((c) => S2T[c] ?? c).join('').replace(/周([一二三四五六日天])/g, '週$1').trim();
}
const squash = (s: string) => normalizeQuestion(s).replace(/[\s（）()「」『』"'“”‘’、，,。.!?！？:：]/g, '').toLowerCase();

const minutesText = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? t('ai.duration.hm', { h, m }) : t('ai.duration.m', { m });
};
const whereText = (room: string) => {
  if (!room) return '';
  const b = buildingFromRoom(room);
  return `${t('ai.sep')}**${room}**${b ? t('ai.schedule.building', { name: b.name }) : ''}`;
};
const mapSource = (p: CampusPlace): SourceRef => ({ title: t('ai.src.map', { name: p.name }), url: mapsSearchUrl(p), kind: 'campus' });
const roomSources = (rooms: string[]): SourceRef[] => {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const r of rooms) {
    const b = r ? buildingFromRoom(r) : undefined;
    if (b && !seen.has(b.code)) { seen.add(b.code); out.push(mapSource(b)); }
  }
  return out.slice(0, 3);
};

/** The user's course the question is about: full name, or a distinctive part of it (≥ 2 chars). */
export function findCourse(q: string, courses: Course[]): Course | undefined {
  const sq = squash(q);
  let best: { c: Course; score: number } | undefined;
  for (const c of courses) {
    const name = squash(c.name.replace(/（助教）$/, ''));
    if (!name) continue;
    let score = 0;
    if (sq.includes(name)) score = name.length * 2;
    else {
      // Longest common substring, e.g. 「經濟」 for 經濟學, "data" for Data Structures.
      for (let len = Math.min(name.length, 12); len >= 2 && !score; len -= 1) {
        for (let i = 0; i + len <= name.length; i += 1) {
          if (sq.includes(name.slice(i, i + len)) && (len >= 3 || len / name.length >= 0.5)) { score = len; break; }
        }
      }
    }
    // The TA session wins only when the question mentions 助教 / TA.
    if (score > 0 && /（助教）$/.test(c.name)) score += /助教|\bta\b/i.test(q) ? 0.5 : -0.5;
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c;
}

const ZH_DAY: Record<string, Weekday> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
const EN_DAY: Record<string, Weekday> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

function resolveDay(q: string, now: Date): { date: Date; label: string } | null {
  if (/後天|day after tomorrow/i.test(q)) return { date: addDays(now, 2), label: t('ai.day.afterTomorrow') };
  if (/明天|明日|tomorrow/i.test(q)) return { date: addDays(now, 1), label: t('ai.day.tomorrow') };
  if (/今天|今日|today/i.test(q)) return { date: now, label: t('ai.day.today') };
  const zh = q.match(/(?:週|星期|禮拜)([一二三四五六日天])/);
  const en = q.toLowerCase().match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/);
  const target = zh ? ZH_DAY[zh[1]!] : en ? EN_DAY[en[1]!] : undefined;
  if (target) {
    const diff = (target - weekdayOf(now) + 7) % 7;
    return { date: addDays(now, diff), label: WEEKDAY_LABELS[target] };
  }
  return null;
}

function helpAnswer(q: string): EngineAnswer | null {
  if (!/^(你好|您好|嗨|哈囉|hi|hello|hey)\b|^(你好|您好|嗨|哈囉)|你(可以|能|會)(做|幫|問)|怎麼用|使用說明|功能|\bhelp\b|what can you|how do i use/i.test(q)) return null;
  return { content: t('ai.help'), sources: [] };
}

function dateAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(今天|現在)(是)?(幾號|幾月幾號|星期幾|禮拜幾|週幾|日期)|現在幾點|what('s| is) (the )?(date|time|day)|what day is it/i.test(q)) return null;
  return { content: t('ai.date.answer', { date: formatDateLong(input.now), time: formatTime(input.now) }), sources: [] };
}

const ymd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, (m ?? 1) - 1, d ?? 1); };

function semesterAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(第幾週|第幾周|幾週了|開學|學期.*(結束|什麼時候|剩)|期末.*(什麼時候|還有幾)|放假)|which week|week of (the )?semester|semester (start|end)|when does (the )?semester/i.test(q)) return null;
  const s = input.semester;
  if (!s) return { content: t('ai.semester.none'), sources: [] };
  const start = ymd(s.startDate), end = ymd(s.endDate);
  const today = startOfDay(input.now);
  const vars = { name: s.name, start: formatDateShort(start), end: formatDateShort(end) };
  const src: SourceRef[] = [{ title: t('ai.src.semester'), kind: 'personal' }];
  if (today < start) return { content: t('ai.semester.before', { ...vars, days: Math.round((start.getTime() - today.getTime()) / 86_400_000) }), sources: src };
  if (today > end) return { content: t('ai.semester.after', vars), sources: src };
  // Weeks count from the Monday of the opening week.
  const monday = addDays(start, -((weekdayOf(start) + 6) % 7));
  const week = Math.floor((today.getTime() - monday.getTime()) / (7 * 86_400_000)) + 1;
  const left = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  return { content: t('ai.semester.week', { ...vars, week, left }), sources: src };
}

function nowNextAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(下一堂|下堂|下節|下一節|等一下|等等|待會|接下來|現在|正在上|目前在上).*(課|上什麼|在哪|教室)|^(下一堂|下堂|下一節)|\bnext (class|lecture)\b|\b(current|now)\b.*\bclass|what class (is it|am i in)/i.test(q)) return null;
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const next = findNextClass(input.courses, input.now);
  if (!next) return { content: t('ai.now.none'), sources: [personalSchedule()] };
  const vars = { name: next.course.name, start: next.slot.startTime, end: next.slot.endTime, where: whereText(next.slot.room), teacher: next.course.instructor ? `${t('ai.sep')}${next.course.instructor}` : '' };
  const sources = [personalSchedule(), ...roomSources([next.slot.room])];
  if (next.ongoing) {
    const left = Math.max(1, Math.round((next.endsAt.getTime() - input.now.getTime()) / 60_000));
    const after = findNextClass(input.courses, new Date(next.endsAt.getTime() + 60_000));
    const then = after && startOfDay(after.startsAt).getTime() === startOfDay(input.now).getTime()
      ? `\n\n${t('ai.now.then', { name: after.course.name, start: after.slot.startTime, where: whereText(after.slot.room) })}` : '';
    return { content: t('ai.now.ongoing', { ...vars, left: minutesText(left) }) + then, sources };
  }
  const mins = Math.round((next.startsAt.getTime() - input.now.getTime()) / 60_000);
  const sameDay = startOfDay(next.startsAt).getTime() === startOfDay(input.now).getTime();
  const when = sameDay ? t('ai.day.today') : formatDateShort(next.startsAt);
  return { content: t('ai.now.next', { ...vars, when }) + (mins < 24 * 60 ? t('ai.now.in', { time: minutesText(mins) }) : ''), sources };
}

function endAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(幾點下課|什麼時候下課|何時下課|幾點放學|最後一堂.*(結束|下課)|下課時間)|\bwhen (do|does|will) (i|my|class(es)?) (finish|end|get out)|\b(finish|done) (for|with) (the )?day/i.test(q)) return null;
  const day = resolveDay(q, input.now) ?? { date: input.now, label: t('ai.day.today') };
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const list = occurrencesOn(input.courses, weekdayOf(day.date));
  const dateLabel = t('ai.schedule.dateLabel', { label: day.label, date: formatDateShort(day.date) });
  if (!list.length) return { content: t('ai.schedule.none', { date: dateLabel }), sources: [personalSchedule()] };
  const last = [...list].sort((a, b) => a.slot.endTime.localeCompare(b.slot.endTime)).pop()!;
  return { content: t('ai.end.answer', { date: dateLabel, name: last.course.name, end: last.slot.endTime, where: whereText(last.slot.room) }), sources: [personalSchedule()] };
}

function freeAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(空堂|空檔|有空|沒課|休息時間)|\bfree (period|time|slot)s?\b|\bgaps?\b|\bbreaks?\b/i.test(q)) return null;
  const day = resolveDay(q, input.now) ?? { date: input.now, label: t('ai.day.today') };
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const list = occurrencesOn(input.courses, weekdayOf(day.date));
  const dateLabel = t('ai.schedule.dateLabel', { label: day.label, date: formatDateShort(day.date) });
  if (!list.length) return { content: t('ai.free.noClass', { date: dateLabel }), sources: [personalSchedule()] };
  const sorted = [...list].sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
  const gaps: string[] = [];
  let end = toMinutes(sorted[0]!.slot.endTime);
  for (const o of sorted.slice(1)) {
    const s = toMinutes(o.slot.startTime);
    if (s - end >= 40) gaps.push(`- ${fromMinutes(end)}–${o.slot.startTime}${t('ai.paren', { text: minutesText(s - end) })}`);
    end = Math.max(end, toMinutes(o.slot.endTime));
  }
  const range = t('ai.free.range', { start: sorted[0]!.slot.startTime, end: fromMinutes(end) });
  if (!gaps.length) return { content: `${t('ai.free.none', { date: dateLabel })}${range}`, sources: [personalSchedule()] };
  return { content: `${t('ai.free.count', { date: dateLabel, count: gaps.length })}${range}\n\n${gaps.join('\n')}`, sources: [personalSchedule()] };
}

function courseAnswer(q: string, input: EngineInput): EngineAnswer | null {
  const c = findCourse(q, input.courses);
  if (!c) return null;
  // Questions about this course's work belong to the task / exam answers.
  if (/(作業|報告|考試|期中|期末|小考|截止|要交)|\b(homework|assignment|exam|midterm|final|quiz|due|deadline)s?\b/i.test(q)) return null;
  const teacherQ = /(誰教|老師是|教授是|哪位老師|授課老師|老師)|\b(who teaches|teacher|professor|instructor|lecturer)\b/i.test(q);
  if (teacherQ && !/(在哪|教室|幾點|時間|什麼時候|哪天)/.test(q)) {
    return {
      content: c.instructor ? t('ai.course.teacher', { name: c.name, teacher: c.instructor }) : t('ai.course.noTeacher', { name: c.name }),
      sources: [personalSchedule()],
    };
  }
  if (!c.slots.length) return { content: t('ai.course.noSlots', { name: c.name }), sources: [personalSchedule()] };
  const slots = [...c.slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  const lines = slots.map((s) => {
    const p = formatPeriods(timesToPeriods(s.startTime, s.endTime));
    return `- ${WEEKDAY_LABELS[s.weekday]} ${s.startTime}–${s.endTime}${p ? t('ai.schedule.periods', { p }) : ''}${s.room ? whereText(s.room) : `${t('ai.sep')}${t('ai.schedule.noRoom')}`}`;
  });
  const teacher = c.instructor ? t('ai.paren', { text: c.instructor }) : '';
  return { content: `${t('ai.course.slots', { name: c.name, teacher, count: slots.length })}\n\n${lines.join('\n')}`, sources: [personalSchedule(), ...roomSources(slots.map((s) => s.room))] };
}

function weekAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(這週|本週|這禮拜|一週|整週|每週|這學期).*(課表|課)|^課表$|我的課表|全部的課|所有課|有哪些課|幾門課|(week|weekly) (schedule|timetable)|my (schedule|timetable)|all (my )?classes|how many (classes|courses)/i.test(q)) return null;
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const days: string[] = [];
  let total = 0;
  for (let d = 1 as Weekday; d <= 7; d = (d + 1) as Weekday) {
    const list = occurrencesOn(input.courses, d);
    if (!list.length) continue;
    total += list.length;
    days.push(`- **${WEEKDAY_LABELS[d]}**${t('ai.colon')}${list.map(({ course, slot }) => `${slot.startTime} ${course.name}${slot.room ? t('ai.paren', { text: slot.room }) : ''}`).join(t('ai.listSep'))}`);
  }
  const names = new Set(input.courses.map((c) => c.name.replace(/（助教）$/, '')));
  return { content: `${t('ai.week.title', { courses: names.size, count: total })}\n\n${days.join('\n')}`, sources: [personalSchedule()] };
}

function scheduleAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(課|上課|教室|第[一二三四五1-9]堂|幾點)|\b(class|classes|lecture|course|room)\b/i.test(q)) return null;
  const day = resolveDay(q, input.now) ?? { date: input.now, label: t('ai.day.today') };
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const list = occurrencesOn(input.courses, weekdayOf(day.date));
  const dateLabel = t('ai.schedule.dateLabel', { label: day.label, date: formatDateShort(day.date) });
  if (list.length === 0) return { content: t('ai.schedule.none', { date: dateLabel }), sources: [personalSchedule()] };

  const wantsFirst = /第一堂|第1堂|最早|\bfirst\b|earliest/i.test(q);
  const wantsLast = /最後一堂|最晚|\blast\b|latest/i.test(q);
  const pick = wantsFirst ? [list[0]!] : wantsLast ? [list[list.length - 1]!] : list;
  const lines = pick.map(({ course, slot }) => {
    const b = buildingFromRoom(slot.room);
    const where = slot.room ? `**${slot.room}**${b ? t('ai.schedule.building', { name: b.name }) : ''}` : t('ai.schedule.noRoom');
    const p = formatPeriods(timesToPeriods(slot.startTime, slot.endTime));
    return `- ${slot.startTime}–${slot.endTime}${p ? t('ai.schedule.periods', { p }) : ''}　${course.name}${t('ai.sep')}${where}${course.instructor ? `${t('ai.sep')}${course.instructor}` : ''}`;
  });
  const head = wantsFirst
    ? t('ai.schedule.first', { date: dateLabel })
    : wantsLast
      ? t('ai.schedule.last', { date: dateLabel })
      : t('ai.schedule.count', { date: dateLabel, count: list.length });
  return { content: `${head}\n\n${lines.join('\n')}`, sources: [personalSchedule()] };
}

function examAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(考試|期中|期末|小考|考什麼|要考)|\b(exam|exams|midterm|midterms|final|finals|quiz|quizzes|test)\b/i.test(q)) return null;
  const days = /下週|下周|next week/i.test(q) ? 14 : /這週|本週|這周|this week/i.test(q) ? 7 : 30;
  const course = findCourse(q, input.courses);
  const exams = upcomingExams(input.tasks, input.now, days).filter((e) => !course || e.courseId === course.id);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  if (exams.length === 0) return { content: course ? t('ai.exams.noneFor', { days, name: course.name }) : t('ai.exams.none', { days }), sources: [personalTasks()] };
  const lines = exams.map((e) => {
    const cn = name(e.courseId);
    return `- **${formatDue(e.dueAt, input.now)}**　${TASK_KIND_LABELS[e.kind]}${t('ai.colon')}${cn ?? e.title}${cn && e.title !== cn ? t('ai.paren', { text: e.title }) : ''}`;
  });
  return { content: `${t('ai.exams.count', { days, count: exams.length })}\n\n${lines.join('\n')}`, sources: [personalTasks()] };
}

function taskAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(作業|待辦|截止|報告|要交|任務)|\b(homework|assignment|assignments|to-?dos?|tasks?|due|deadline|deadlines|report)\b/i.test(q)) return null;
  const course = findCourse(q, input.courses);
  const mine = course ? input.tasks.filter((x) => x.courseId === course.id) : input.tasks;
  const overdue = filterTasks(mine, 'overdue', input.now);
  const view = /今天|今日|today/i.test(q) ? 'today' : course || /(全部|所有|還有哪些)|\ball\b/i.test(q) ? 'all' : 'week';
  const list = (view === 'all' ? mine.filter((x) => !x.completed).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : filterTasks(mine, view, input.now))
    .filter((x) => new Date(x.dueAt) >= input.now);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  const fmt = (x: Task) => `- **${formatDue(x.dueAt, input.now)}**　${x.title}${t('ai.paren', { text: `${TASK_KIND_LABELS[x.kind]}${name(x.courseId) ? `｜${name(x.courseId)}` : ''}` })}`;
  const when = course ? t('ai.quote', { text: course.name }) : view === 'today' ? t('ai.day.today') : view === 'all' ? t('ai.upcoming') : t('ai.thisWeek');
  const parts: string[] = [];
  parts.push(list.length ? `${t('ai.tasks.count', { when, count: list.length })}\n\n${list.map(fmt).join('\n')}` : t('ai.tasks.none', { when }));
  if (overdue.length) parts.push(`${t('ai.tasks.overdue', { count: overdue.length })}\n\n${overdue.slice(0, 5).map(fmt).join('\n')}`);
  return { content: parts.join('\n\n'), sources: [personalTasks()] };
}

function findPlace(q: string): CampusPlace | undefined {
  const room = q.toUpperCase().match(/\b([A-Z]{1,2})\s?\d{2,4}\b/);
  if (room) return buildingFromRoom(room[0].replace(/\s/g, ''));
  const byName = [...CAMPUS_PLACES].sort((a, b) => b.name.length - a.name.length).find((p) => q.includes(p.name));
  if (byName) return byName;
  const code = q.toUpperCase().match(/\b([A-Z]{1,2})\s*(館|棟|大樓|BUILDING)/);
  return code ? CAMPUS_PLACES.find((p) => p.code === code[1]) : undefined;
}

function placeAnswer(q: string): EngineAnswer | null {
  if (!/(在哪|哪裡|位置|怎麼走|地點|大樓|館|教室代碼)|\b(where|building|location)\b/i.test(q) && !/\b[A-Z]{1,2}\d{2,4}\b/i.test(q)) return null;
  const p = findPlace(q);
  if (!p) return null;
  const sources: SourceRef[] = [{ title: p.source.name, url: p.source.url, kind: 'campus' }];
  if (p.coords) {
    sources.unshift(mapSource(p));
    if (p.coordsSource) sources.push({ title: p.coordsSource.name, url: p.coordsSource.url, kind: 'campus' });
  }
  return { content: t(p.coords ? 'ai.place.answerMap' : 'ai.place.answer', { code: p.code, name: p.name }), sources };
}

function periodAnswer(q: string): EngineAnswer | null {
  const zh = q.match(/第\s*([一二三四五六七八九十]{1,3})\s*節/);
  const zhN = zh ? (() => { const d: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }; const x = zh[1]!; return x === '十' ? 10 : x.startsWith('十') ? 10 + (d[x[1]!] ?? 0) : d[x] ?? 0; })() : 0;
  const m = zhN ? [zh![0], String(zhN)] : q.match(/第\s*(\d{1,2})\s*節|\bperiod\s*(\d{1,2})\b/i);
  if (!m && !/節次|class periods|period times/i.test(q)) return null;
  const src: SourceRef = { title: PERIOD_SOURCE.name, url: PERIOD_SOURCE.url, publisher: t('ai.src.tku'), kind: 'official' };
  if (m) {
    const n = Number(m[1] ?? m[2]);
    const p = TKU_PERIODS.find((x) => x.no === n);
    if (!p) return { content: t('ai.period.unknown', { n }), sources: [src] };
    return { content: t('ai.period.one', { n: p.no, start: p.start, end: p.end }), sources: [src] };
  }
  return { content: TKU_PERIODS.map((p) => `- ${t('periods.one', { n: p.no })}${t('ai.colon')}${p.start}–${p.end}`).join('\n'), sources: [src] };
}

function eventAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(活動|講座|競賽|黑客松|實習|獎學金|比賽)|\b(events?|talks?|contests?|hackathons?|internships?|scholarships?|competitions?)\b/i.test(q)) return null;
  if (input.events === null) return { content: t('ai.events.notConnected'), sources: [] };
  const weekEnd = addDays(startOfDay(input.now), 8).getTime();
  const list = input.events.filter((e) => (/這週|本週|這周|this week/i.test(q) ? new Date(e.startsAt).getTime() < weekEnd : true)).slice(0, 6);
  if (!list.length) return { content: t('ai.events.none'), sources: [] };
  return {
    content: `${t('ai.events.count', { count: list.length })}\n\n${list.map((e) => `- **${formatDateShort(new Date(e.startsAt))}**　${e.title}${t('ai.paren', { text: EVENT_CATEGORY_LABELS[e.category] })}`).join('\n')}`,
    sources: list.map((e) => ({ title: e.sourceName, url: e.sourceUrl, kind: 'campus' as const })),
  };
}

function knowledgeAnswer(q: string): EngineAnswer | null {
  const lower = q.toLowerCase();
  const hits = OFFICIAL_SOURCES.filter((s) => s.keywords.some((k) => q.includes(k)) || s.keywordsEn.some((k) => lower.includes(k)));
  if (!hits.length) return null;
  const top = hits.slice(0, 2);
  const en = !isChinese();
  const docs = top.map((s) => (en ? `“${s.titleEn}” (《${s.title}》)` : `《${s.title}》`)).join(t('ai.and'));
  return {
    content: t('ai.knowledge.answer', { docs }),
    sources: top.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url, updated: s.updated, kind: 'official' as const })),
  };
}

export function answerLocally(raw: EngineInput): EngineAnswer {
  const q = normalizeQuestion(raw.question);
  const input = { ...raw, question: q };
  return (
    helpAnswer(q) ??
    dateAnswer(q, input) ??
    semesterAnswer(q, input) ??
    periodAnswer(q) ??
    examAnswer(q, input) ??
    taskAnswer(q, input) ??
    nowNextAnswer(q, input) ??
    endAnswer(q, input) ??
    freeAnswer(q, input) ??
    weekAnswer(q, input) ??
    placeAnswer(q) ??
    courseAnswer(q, input) ??
    scheduleAnswer(q, input) ??
    eventAnswer(q, input) ??
    knowledgeAnswer(q) ?? { content: t('ai.fallback'), sources: [] }
  );
}
