import type { CampusEvent, Course, Semester, Task, Weekday } from '@/lib/types';
import { findNextClass, occurrencesOn } from '@/lib/schedule';
import { addDays, formatDateShort, formatTime, fromMinutes, toMinutes, weekdayOf, startOfDay, startOfWeek, toDateInput } from '@/lib/time';
import { filterTasks } from '@/lib/tasks';
import { EXAM_KINDS, TASK_KIND_LABELS, WEEKDAY_LABELS, EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatPeriods, timesToPeriods, PERIOD_SOURCE, TKU_PERIODS } from '@/lib/periods';
import { CAMPUS_PLACES, buildingFromRoom, mapsSearchUrl, type CampusPlace } from '@/data/places';
import { OFFICIAL_SOURCES } from '@/data/sources';
import { t } from '@/i18n/t';
import { isChinese } from '@/i18n';
import type { SourceRef } from './types';
import { chineseNumber, referenceTime, resolveClock, resolveDay } from './localTime';

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
const S2T: Record<string, string> = Object.fromEntries([...'课节几点里这试业办报讲奖学赛实习楼馆么时间后结东门还没吗现开帮图书请规则选补证费厅样怎为个们说对边从网络经济资计设统数据题线总礼体讯务础语'].map((c, i) => [c, '課節幾點裡這試業辦報講獎學賽實習樓館麼時間後結東門還沒嗎現開幫圖書請規則選補證費廳樣怎為個們說對邊從網絡經濟資計設統數據題線總禮體訊務礎語'[i]!]));
export const SIMPLIFIED_CHARS = new Set(Object.keys(S2T));
export function normalizeQuestion(q: string): string {
  return [...q.normalize('NFKC')].map((c) => S2T[c] ?? c).join('').replace(/周/g, '週').replace(/課錶/g, '課表').replace(/ㄉ/g, '的').replace(/上克|上ㄎ/g, '上課').replace(/下克/g, '下課').trim();
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

// Aliases resolve against the user's stored courses; they do not create course data.
// Only widely used abbreviations are fixed; course nicknames (個經、程設、資安…) are matched against the
// student's own course names below, so another student's 「資安」 finds their own 資訊安全 course.
const COURSE_ALIASES: [RegExp, string][] = [
  [/\bos\b/gi, '作業系統'], [/\bpy(?:thon)?\b/gi, 'Python'], [/英文[二2]/g, '英文（二）'],
];
const baseName = (c: Course) => c.name.replace(/[（(]助教[）)]$/, '');
/** 「個經」→ 個體經濟學: same first character, the rest appear in order. */
function abbreviates(abbr: string, name: string): boolean {
  const chars = [...abbr];
  if (chars.length < 2 || name.length <= chars.length || !name.startsWith(chars[0]!)) return false;
  let at = 1;
  for (const ch of chars.slice(1)) {
    const found = name.indexOf(ch, at);
    if (found < 0) return false;
    at = found + 1;
  }
  return true;
}
function expandAliases(q: string, courses: Course[] = []): string {
  let text = COURSE_ALIASES.reduce((acc, [re, name]) => acc.replace(re, name), normalizeQuestion(q));
  const names = [...new Set(courses.map(baseName))];
  // Slide over every run of Chinese characters: 「想看個經的上課時間」 contains 「個經」.
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (names.some((n) => run.includes(n))) continue; // the full name is already there
    for (const len of [3, 2]) {
      let replaced = false;
      for (let i = 0; i + len <= run.length && !replaced; i += 1) {
        const piece = run.slice(i, i + len);
        if (names.some((n) => n.includes(piece))) continue; // a real fragment, not a nickname
        const hits = names.filter((n) => abbreviates(piece, n));
        if (hits.length === 1) { text = text.replace(piece, hits[0]!); replaced = true; }
      }
      if (replaced) break;
    }
  }
  return text;
}
const isTA = (c: Course) => /[（(]助教[）)]$/.test(c.name);

/** Longest matching course name wins; TA requests never silently select a lecture. */
export function findCourse(q: string, courses: Course[]): Course | undefined {
  const sq = squash(expandAliases(q, courses));
  const wantsTA = /助教|\bta\b/i.test(q);
  // A complete course name in the question (typed or expanded from a nickname) decides the course;
  // never fall back to another course that merely shares a fragment of it.
  const named = new Set(courses.map(baseName).filter((n) => sq.includes(squash(n))));
  const longest = [...named].sort((a, b) => b.length - a.length)[0];
  const candidates = courses.filter((c) => isTA(c) === wantsTA && (!longest || baseName(c) === longest));
  if (longest && !candidates.length) return undefined;
  const ranked = candidates.map((c) => {
    const name = squash(c.name.replace(/[（(]助教[）)]$/, ''));
    let score = 0;
    if (name && sq.includes(name)) score = name.length * 2;
    else for (let len = Math.min(name.length, 12); len >= 2 && !score; len -= 1) {
      for (let i = 0; i + len <= name.length; i += 1) {
        if (!['作業', '資料', '課程', '老師', '時間'].includes(name.slice(i, i + len)) && sq.includes(name.slice(i, i + len)) && (len >= 3 || len / name.length >= 0.5)) { score = len; break; }
      }
    }
    return { c, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  // An ambiguous partial name is insufficient to choose one student's course.
  return ranked[0] && (!ranked[1] || ranked[0].score > ranked[1].score) ? ranked[0].c : undefined;
}

/** Do not interpret the 作業 in 作業系統 or 期中 in a report title as an intent. */
const intentText = (q: string, courses: Course[]) => {
  let text = expandAliases(q, courses);
  for (const c of [...courses].sort((a, b) => b.name.length - a.name.length)) {
    text = text.replaceAll(c.name.replace(/[（(]助教[）)]$/, ''), '');
  }
  return text.replace(/作業系統/g, '');
};
const taskPattern = /(作業|待辦|截止|報告|要交|任務|到期)|\b(homework|assignments?|to-?dos?|tasks?|due|deadlines?|report)\b/i;
const examPattern = /(考試|期中(?!報告)|期末|小考|考什麼|要考)|\b(exams?|midterms?|finals?|quiz|quizzes|test)\b/i;

function helpAnswer(q: string): EngineAnswer | null {
  if (!/^(你好|您好|嗨|哈囉|hi|hello|hey)\b|^(你好|您好|嗨|哈囉)|你(可以|能|會)(做|幫|問)|怎麼用|使用說明|功能|\bhelp\b|what can you|how do i use/i.test(q)) return null;
  return { content: t('ai.help'), sources: [] };
}

function dateAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/幾號|幾月幾號|星期幾|禮拜幾|週幾|日期|現在幾點|YYYY-MM-DD|what('s| is) (the )?(date|time|day)|what day is it/i.test(q)) return null;
  const date = resolveDay(q, input.now)?.date ?? input.now;
  return { content: t('ai.date.answer', { date: /YYYY-MM-DD/i.test(q) ? toDateInput(date) : formatDateShort(date), time: formatTime(date) }), sources: [] };
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
  if (!/下一堂|下堂|下節|下一節|等一下|等等|待會|接下來.*課|現在.*(課|上什麼|哪堂)|正在上|目前在上|(?:以後|之後|後).*第一堂|\bnext (class|lecture)\b|\b(current|now)\b.*\bclass|what class (is it|am i in)/i.test(q)) return null;
  input = { ...input, now: referenceTime(q, input.now) };
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const prefix = resolveDay(q, input.now) || resolveClock(q) !== null ? t('ai.atTime', { date: formatDateShort(input.now), time: formatTime(input.now) }) + '\n' : '';
  const afterOnly = /(?:以後|之後|後).*第一堂/.test(q);
  const searchCourses = afterOnly ? input.courses.map((course) => ({ ...course, slots: course.slots.filter((slot) => slot.weekday !== weekdayOf(input.now) || toMinutes(slot.startTime) >= input.now.getHours() * 60 + input.now.getMinutes()) })) : input.courses;
  const next = findNextClass(searchCourses, input.now);
  if (!next) return { content: t('ai.now.none'), sources: [personalSchedule()] };
  const vars = { name: next.course.name, start: next.slot.startTime, end: next.slot.endTime, where: whereText(next.slot.room), teacher: next.course.instructor ? `${t('ai.sep')}${next.course.instructor}` : '' };
  const sources = [personalSchedule(), ...roomSources([next.slot.room])];
  if (next.ongoing) {
    const left = Math.max(1, Math.round((next.endsAt.getTime() - input.now.getTime()) / 60_000));
    const after = findNextClass(input.courses, new Date(next.endsAt.getTime() + 60_000));
    const then = after && startOfDay(after.startsAt).getTime() === startOfDay(input.now).getTime()
      ? `\n\n${t('ai.now.then', { name: after.course.name, start: after.slot.startTime, where: whereText(after.slot.room) })}` : '';
    return { content: prefix + t('ai.now.ongoing', { ...vars, left: minutesText(left) }) + then, sources };
  }
  const mins = Math.round((next.startsAt.getTime() - input.now.getTime()) / 60_000);
  const sameDay = startOfDay(next.startsAt).getTime() === startOfDay(input.now).getTime();
  const when = sameDay ? t('ai.day.today') : formatDateShort(next.startsAt);
  return { content: prefix + t('ai.now.next', { ...vars, when }) + (mins < 24 * 60 ? t('ai.now.in', { time: minutesText(mins) }) : ''), sources };
}

function endAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(幾點下課|什麼時候下課|何時下課|幾點放學|幾點結束.*課|最後一堂.*(結束|下課)|下課時間)|\bwhen (do|does|will) (i|my|class(es)?) (finish|end|get out)|\b(finish|done) (for|with) (the )?day/i.test(q)) return null;
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

/** A boundary between named lessons is not necessarily entirely free: show intervening lessons. */
function betweenAnswer(q: string, input: EngineInput): EngineAnswer | null {
  const parts = q.match(/^(.+?)(?:下課|結束)\s*(?:到|至)\s*(.+?)(?:上課|開始)(?:.*)$/);
  if (!parts) return null;
  const from = findCourse(parts[1]!, input.courses), to = findCourse(parts[2]!, input.courses);
  const day = resolveDay(q, input.now);
  if (!from || !to) return { content: t('ai.fallback'), sources: [] };
  const pairs = from.slots.flatMap((a) => to.slots.filter((b) => a.weekday === b.weekday
    && (!day || a.weekday === weekdayOf(day.date)) && a.endTime <= b.startTime).map((b) => ({ a, b })));
  if (!pairs.length) return { content: t('ai.fallback'), sources: [] };
  return { content: pairs.map(({ a, b }) => {
    const inside = occurrencesOn(input.courses, a.weekday).filter((o) => o.course.id !== from.id && o.course.id !== to.id
      && o.slot.startTime < b.startTime && o.slot.endTime > a.endTime);
    const boundary = t('ai.free.between', { from: from.name, to: to.name, day: WEEKDAY_LABELS[a.weekday], start: a.endTime, end: b.startTime });
    return boundary + (inside.length ? '\n' + inside.map((o) => `- ${o.slot.startTime}–${o.slot.endTime} ${o.course.name}`).join('\n') : '');
  }).join('\n\n'), sources: [personalSchedule()] };
}

function unsupportedAnswer(q: string): EngineAnswer | null {
  // These facts are not contained in the stored schedule, tasks or verified place table.
  return /公車|巴士|公交|下學期|電話|手機|信箱|email|e-mail|辦公室|菜單|停課|颱風|加簽密碼|買.*(書|課本)|考試答案|\bbus\b|next semester|phone|office hours/i.test(q)
    ? { content: t('ai.unknown'), sources: [] } : null;
}

function courseAnswer(q: string, input: EngineInput): EngineAnswer | null {
  const c = findCourse(q, input.courses);
  if (!c) return null;
  // Questions about this course's work belong to the task / exam answers.
  if (taskPattern.test(intentText(q, input.courses)) || examPattern.test(intentText(q, input.courses))) return null;
  const teacherQ = /(誰教|老師是|教授是|哪位老師|授課老師|老師)|\b(who teaches|teacher|professor|instructor|lecturer)\b/i.test(q);
  if (teacherQ && !/(在哪|教室|幾點|時間|什麼時候|哪天)/.test(q)) {
    return {
      content: c.instructor ? t('ai.course.teacher', { name: c.name, teacher: c.instructor }) : t('ai.course.noTeacher', { name: c.name }),
      sources: [personalSchedule()],
    };
  }
  if (!c.slots.length) return { content: t('ai.course.noSlots', { name: c.name }), sources: [personalSchedule()] };
  const day = resolveDay(q, input.now);
  const slots = [...c.slots].filter((slot) => !day || slot.weekday === weekdayOf(day.date)).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  const lines = slots.map((s) => {
    const p = formatPeriods(timesToPeriods(s.startTime, s.endTime));
    return `- ${WEEKDAY_LABELS[s.weekday]} ${s.startTime}–${s.endTime}${p ? t('ai.schedule.periods', { p }) : ''}${s.room ? whereText(s.room) : `${t('ai.sep')}${t('ai.schedule.noRoom')}`}`;
  });
  const teacher = c.instructor ? t('ai.paren', { text: c.instructor }) : '';
  return { content: `${t('ai.course.slots', { name: c.name, teacher, count: slots.length })}\n\n${lines.join('\n')}`, sources: [personalSchedule(), ...roomSources(slots.map((s) => s.room))] };
}

function weekAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (resolveDay(q, input.now)) return null;
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
  if (!/(課|上課|教室|第[一二三四五1-9]堂|幾點)|\b(class|classes|lecture|course|room)\b/i.test(q)
    && !(resolveDay(q, input.now) && (/從早到晚|整天/.test(q) || /^\d{1,2}\/\d{1,2}[?？]?$/.test(q)))) return null;
  const day = resolveDay(q, input.now) ?? { date: input.now, label: t('ai.day.today') };
  if (input.courses.length === 0) return { content: t('ai.schedule.empty'), sources: [personalSchedule()] };
  const list = occurrencesOn(input.courses, weekdayOf(day.date));
  const dateLabel = t('ai.schedule.dateLabel', { label: day.label, date: formatDateShort(day.date) });
  if (list.length === 0) return { content: t('ai.schedule.none', { date: dateLabel }), sources: [personalSchedule()] };

  const wantsFirst = /第一堂|第1堂|最早|\bfirst\b|earliest/i.test(q);
  const wantsLast = /最後一堂|最晚|\blast\b|latest/i.test(q);
  const clock = resolveClock(q);
  const eligible = clock !== null && /以後|之後|後/.test(q) ? list.filter((o) => toMinutes(o.slot.startTime) >= clock) : list;
  if (!eligible.length) return { content: t('ai.schedule.none', { date: dateLabel }), sources: [personalSchedule()] };
  const pick = wantsFirst ? [eligible[0]!] : wantsLast ? [eligible[eligible.length - 1]!] : eligible;
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

/** Calendar boundaries (not rolling seven-day windows) for dated task queries. */
function taskWindow(q: string, now: Date): { start: Date; end: Date } | null {
  const day = resolveDay(q, now);
  if (day) return { start: startOfDay(day.date), end: addDays(startOfDay(day.date), 1) };
  if (/下週|下禮拜|下星期|next week/i.test(q)) { const start = addDays(startOfWeek(now), 7); return { start, end: addDays(start, 7) }; }
  if (/這週|本週|這禮拜|this week/i.test(q)) { const start = startOfWeek(now); return { start, end: addDays(start, 7) }; }
  return null;
}
function examAnswer(q: string, input: EngineInput): EngineAnswer | null {
  const intent = intentText(q, input.courses);
  if (!examPattern.test(intent) || taskPattern.test(intent)) return null;
  const course = findCourse(q, input.courses);
  const window = taskWindow(q, input.now);
  const days = window ? Math.round((window.end.getTime() - window.start.getTime()) / 86400000) : 30;
  const exams = input.tasks.filter((e) => !e.completed && EXAM_KINDS.includes(e.kind) && (!course || e.courseId === course.id)
    && new Date(e.dueAt) >= input.now && (!window || (new Date(e.dueAt) >= window.start && new Date(e.dueAt) < window.end)))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  if (!exams.length) return { content: (course ? t('ai.quote', { text: course.name }) : window ? formatDateShort(window.start) : '') + t('ai.exams.noneUpcoming'), sources: [personalTasks()] };
  const lines = exams.map((e) => {
    const cn = input.courses.find((c) => c.id === e.courseId)?.name;
    return `- **${formatDateShort(new Date(e.dueAt))} ${formatTime(new Date(e.dueAt))}**　${TASK_KIND_LABELS[e.kind]}${t('ai.colon')}${cn ?? e.title}${cn && e.title !== cn ? t('ai.paren', { text: e.title }) : ''}`;
  });
  return { content: `${t(window ? 'ai.exams.count' : 'ai.exams.allCount', { days, count: exams.length })}\n\n${lines.join('\n')}`, sources: [personalTasks()] };
}

function taskAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!taskPattern.test(intentText(q, input.courses))) return null;
  const course = findCourse(q, input.courses);
  const mine = course ? input.tasks.filter((x) => x.courseId === course.id) : input.tasks;
  const window = taskWindow(q, input.now);
  const overdue = window ? [] : filterTasks(mine, 'overdue', input.now);
  const list = mine.filter((x) => !x.completed && new Date(x.dueAt) >= input.now
    && (!window || (new Date(x.dueAt) >= window.start && new Date(x.dueAt) < window.end)))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  const fmt = (x: Task) => `- **${formatDateShort(new Date(x.dueAt))} ${formatTime(new Date(x.dueAt))}**　${x.title}${t('ai.paren', { text: `${TASK_KIND_LABELS[x.kind]}${name(x.courseId) ? `｜${name(x.courseId)}` : ''}` })}`;
  const when = course ? t('ai.quote', { text: course.name }) : window ? formatDateShort(window.start) : t('ai.upcoming');
  const parts = [list.length ? `${t('ai.tasks.count', { when, count: list.length })}\n\n${list.map(fmt).join('\n')}` : t('ai.tasks.none', { when })];
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
  const group = q.match(/(?:第\s*)?([一二三四五六七八九十\d]+(?:\s*[、,，和及與]\s*(?:第\s*)?[一二三四五六七八九十\d]+)*)\s*節/);
  if (group && q.slice(Math.max(0, group.index! - 1), group.index) === '下') return null;
  const en = q.match(/\bperiod\s*(\d{1,2})\b/i);
  if (!group && !en && !/節次|class periods|period times/i.test(q)) return null;
  const src: SourceRef = { title: PERIOD_SOURCE.name, url: PERIOD_SOURCE.url, publisher: t('ai.src.tku'), kind: 'official' };
  const numbers = group ? group[1]!.split(/\s*[、,，和及與]\s*(?:第\s*)?/).map(chineseNumber) : en ? [Number(en[1])] : [];
  if (numbers.length) {
    return { content: numbers.map((n) => {
      const p = TKU_PERIODS.find((x) => x.no === n);
      return p ? t('ai.period.one', { n: p.no, start: p.start, end: p.end }) : t('ai.period.unknown', { n });
    }).join('\n'), sources: [src] };
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
    unsupportedAnswer(q) ??
    helpAnswer(q) ??
    periodAnswer(q) ??
    examAnswer(q, input) ??
    taskAnswer(q, input) ??
    dateAnswer(q, input) ??
    semesterAnswer(q, input) ??
    nowNextAnswer(q, input) ??
    betweenAnswer(q, input) ??
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
