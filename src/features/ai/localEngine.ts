import type { CampusEvent, Course, Task, Weekday } from '@/lib/types';
import { occurrencesOn } from '@/lib/schedule';
import { addDays, formatDateShort, formatDue, weekdayOf, startOfDay } from '@/lib/time';
import { filterTasks, upcomingExams } from '@/lib/tasks';
import { TASK_KIND_LABELS, WEEKDAY_LABELS, EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatPeriods, timesToPeriods, PERIOD_SOURCE, TKU_PERIODS } from '@/lib/periods';
import { CAMPUS_PLACES, buildingFromRoom, type CampusPlace } from '@/data/places';
import { OFFICIAL_SOURCES } from '@/data/sources';
import { t } from '@/i18n/t';
import i18n from '@/i18n';
import type { SourceRef } from './types';

/**
 * 本機校園助理（不需 API Key）：
 * 只根據使用者自己的課表/待辦、已查核的建築代碼與官方文件清單回答。
 * 不會生成校規內容；找不到可靠資料時明確說明。
 * Understands Chinese and English questions; answers in the current UI language.
 */
export interface EngineInput {
  question: string;
  courses: Course[];
  tasks: Task[];
  events: CampusEvent[] | null;
  now: Date;
}
export interface EngineAnswer {
  content: string;
  sources: SourceRef[];
}

const personalSchedule = (): SourceRef => ({ title: t('ai.src.schedule'), kind: 'personal' });
const personalTasks = (): SourceRef => ({ title: t('ai.src.tasks'), kind: 'personal' });

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
  const exams = upcomingExams(input.tasks, input.now, days);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  if (exams.length === 0) return { content: t('ai.exams.none', { days }), sources: [personalTasks()] };
  const lines = exams.map((e) => {
    const cn = name(e.courseId);
    return `- **${formatDue(e.dueAt, input.now)}**　${TASK_KIND_LABELS[e.kind]}${t('ai.colon')}${cn ?? e.title}${cn && e.title !== cn ? t('ai.paren', { text: e.title }) : ''}`;
  });
  return { content: `${t('ai.exams.count', { days, count: exams.length })}\n\n${lines.join('\n')}`, sources: [personalTasks()] };
}

function taskAnswer(q: string, input: EngineInput): EngineAnswer | null {
  if (!/(作業|待辦|截止|報告|要交|任務)|\b(homework|assignment|assignments|to-?dos?|tasks?|due|deadline|deadlines|report)\b/i.test(q)) return null;
  const overdue = filterTasks(input.tasks, 'overdue', input.now);
  const view = /今天|今日|today/i.test(q) ? 'today' : 'week';
  const list = filterTasks(input.tasks, view, input.now).filter((x) => new Date(x.dueAt) >= input.now);
  const name = (id?: string | null) => input.courses.find((c) => c.id === id)?.name;
  const fmt = (x: Task) => `- **${formatDue(x.dueAt, input.now)}**　${x.title}${t('ai.paren', { text: `${TASK_KIND_LABELS[x.kind]}${name(x.courseId) ? `｜${name(x.courseId)}` : ''}` })}`;
  const when = view === 'today' ? t('ai.day.today') : t('ai.thisWeek');
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
  return { content: t('ai.place.answer', { code: p.code, name: p.name }), sources: [{ title: p.source.name, url: p.source.url, kind: 'campus' }] };
}

function periodAnswer(q: string): EngineAnswer | null {
  const m = q.match(/第\s*(\d{1,2})\s*節|\bperiod\s*(\d{1,2})\b/i);
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
  const en = i18n.language === 'en';
  const docs = top.map((s) => (en ? `“${s.titleEn}” (《${s.title}》)` : `《${s.title}》`)).join(t('ai.and'));
  return {
    content: t('ai.knowledge.answer', { docs }),
    sources: top.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url, updated: s.updated, kind: 'official' as const })),
  };
}

export function answerLocally(input: EngineInput): EngineAnswer {
  const q = input.question.trim();
  return (
    periodAnswer(q) ??
    examAnswer(q, input) ??
    taskAnswer(q, input) ??
    placeAnswer(q) ??
    scheduleAnswer(q, input) ??
    eventAnswer(q, input) ??
    knowledgeAnswer(q) ?? { content: t('ai.fallback'), sources: [] }
  );
}
