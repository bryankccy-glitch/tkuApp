import type { CalendarEvent, Task } from './types';
import { calendarItemsOn, taipeiDayKey } from './studentCalendar';
import { taipeiMinutes } from './taipei';
import { ACADEMIC_TERMS, type AcademicTerm } from '@/data/academicCalendar';

/** One hero line under the greeting, picked from the student's own day (exams, shifts, deadlines, classes). */
export interface Cheer {
  /** i18n key under `greeting.cheer` */
  key: string;
  vars?: Record<string, string | number>;
}

export interface CheerInput {
  now: Date;
  /** Today's class meetings and how many are still ahead. */
  classes: { total: number; remaining: number };
  tasks: Task[];
  events: CalendarEvent[];
  /** School exam periods; defaults to the official academic calendar. */
  terms?: AcademicTerm[];
}

const DAY = 86_400_000;
const EXAM_KINDS = new Set<Task['kind']>(['quiz', 'midterm', 'final']);
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** Whole Taipei calendar days from `today` to `day` (both YYYY-MM-DD). */
const daysBetween = (today: string, day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

/** Midterm season = the two weeks before midterm grade upload opens; finals = 7 days before and during 期末多元評量週. */
export function schoolExamCheer(today: string, terms: AcademicTerm[] = ACADEMIC_TERMS): Cheer | null {
  for (const term of terms) {
    const toUpload = daysBetween(today, term.midtermUploadStart);
    if (toUpload >= 1 && toUpload <= 14) return { key: 'schoolMidterm' };
    const toFinal = daysBetween(today, term.finalStart);
    if (toFinal >= 1 && toFinal <= 7) return { key: 'schoolFinalSoon', vars: { days: toFinal } };
    if (toFinal <= 0 && today <= term.finalEnd) return { key: 'schoolFinal' };
  }
  return null;
}

/**
 * Priority: exam today → exam just finished → shift in progress → exam within a week → deadlines today →
 * later shift / club / appointment / study → school exam season (official calendar) → shift finished → long day finished → classes finished → Friday / weekend → long day ahead → overdue.
 * Returns null when nothing personal applies, so the time-of-day line is used.
 */
export function pickCheer({ now, classes, tasks, events, terms }: CheerInput): Cheer | null {
  const today = taipeiDayKey(now);
  const nowMin = taipeiMinutes(now);
  const nowMs = now.getTime();
  const evening = nowMin >= 17 * 60 || nowMin < 4 * 60;

  const exams = tasks
    .filter((t) => EXAM_KINDS.has(t.kind))
    .map((t) => ({ task: t, day: taipeiDayKey(new Date(t.dueAt)), at: new Date(t.dueAt).getTime() }))
    .sort((a, b) => a.at - b.at);
  const examToday = exams.find((e) => e.day === today && e.at > nowMs && !e.task.completed);
  if (examToday) return { key: 'examToday', vars: { title: examToday.task.title, time: hhmm(taipeiMinutes(new Date(examToday.at))) } };
  const examDone = exams.filter((e) => e.day === today && e.at <= nowMs).pop();
  if (examDone) return { key: 'examDone', vars: { title: examDone.task.title } };

  const personal = calendarItemsOn(today, [], [], events)
    .filter((i) => i.event)
    .map((i) => ({ kind: i.event!.kind, title: i.title, start: toMinutes(i.time), end: i.endTime ? toMinutes(i.endTime) : toMinutes(i.time) }));
  const shiftNow = personal.find((p) => p.kind === 'work' && p.start <= nowMin && nowMin < p.end);
  if (shiftNow) return { key: 'workNow', vars: { end: hhmm(shiftNow.end) } };

  const soon = exams.find((e) => !e.task.completed && e.at > nowMs && e.task.kind !== 'quiz' && daysBetween(today, e.day) <= 7);
  if (soon) {
    const days = daysBetween(today, soon.day);
    const kind = soon.task.kind === 'final' ? 'final' : 'midterm';
    return days === 1 ? { key: `${kind}Tomorrow`, vars: { title: soon.task.title } } : { key: `${kind}Soon`, vars: { title: soon.task.title, days } };
  }
  const quizTomorrow = exams.find((e) => !e.task.completed && e.task.kind === 'quiz' && daysBetween(today, e.day) === 1);
  if (quizTomorrow) return { key: 'quizTomorrow', vars: { title: quizTomorrow.task.title } };

  const dueToday = tasks.filter((t) => !t.completed && !EXAM_KINDS.has(t.kind) && taipeiDayKey(new Date(t.dueAt)) === today && new Date(t.dueAt).getTime() > nowMs);
  if (dueToday.length === 1) return { key: 'dueOne', vars: { title: dueToday[0]!.title } };
  if (dueToday.length > 1) return { key: 'dueMany', vars: { count: dueToday.length } };

  const later = personal.filter((p) => p.start > nowMin).sort((a, b) => a.start - b.start);
  const nextShift = later.find((p) => p.kind === 'work');
  if (nextShift) return { key: 'workLater', vars: { time: hhmm(nextShift.start) } };
  const nextOther = later.find((p) => p.kind === 'club' || p.kind === 'appointment' || p.kind === 'study');
  if (nextOther) return { key: nextOther.kind, vars: { title: nextOther.title, time: hhmm(nextOther.start) } };
  const season = schoolExamCheer(today, terms);
  if (season) return season;
  if (evening && personal.some((p) => p.kind === 'work' && p.end <= nowMin)) {
    return classes.total ? { key: 'workAndClassesDone', vars: { count: classes.total } } : { key: 'workDone' };
  }

  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (classes.total && classes.remaining === 0) {
    if (weekday === 5) return { key: 'fridayDone' };
    if (classes.total >= 4) return { key: 'longDayDone', vars: { count: classes.total } };
    if (evening || nowMin >= 12 * 60) return { key: 'classesDone' };
  }
  if (classes.total === 0 && (weekday === 0 || weekday === 6)) return { key: 'weekend' };
  if (classes.total >= 4 && classes.remaining === classes.total) return { key: 'longDayAhead', vars: { count: classes.total } };

  const overdue = tasks.filter((t) => !t.completed && !EXAM_KINDS.has(t.kind) && new Date(t.dueAt).getTime() < nowMs && nowMs - new Date(t.dueAt).getTime() < 7 * DAY);
  if (overdue.length) return { key: 'overdue', vars: { count: overdue.length } };
  return null;
}
