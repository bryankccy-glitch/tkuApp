import { describe, expect, it } from 'vitest';
import { pickCheer, schoolExamCheer } from '../encouragement';
import { ACADEMIC_TERMS } from '@/data/academicCalendar';
import type { CalendarEvent, Task } from '../types';

const at = (iso: string) => new Date(`${iso}+08:00`);
const task = (over: Partial<Task>): Task => ({
  id: over.title ?? 'x', title: 'x', kind: 'homework', dueAt: '2026-11-02T23:59:00+08:00', priority: 'medium', completed: false,
  remindMinutesBefore: null, createdAt: '2026-10-01T00:00:00+08:00', updatedAt: '2026-10-01T00:00:00+08:00', ...over,
});
const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: over.title ?? 'e', title: 'e', kind: 'work', startsAt: '2026-10-28T18:00:00+08:00', endsAt: '2026-10-28T22:00:00+08:00',
  location: '', notes: '', repeat: 'none', createdAt: '2026-10-01T00:00:00+08:00', updatedAt: '2026-10-01T00:00:00+08:00', ...over,
});
const none = { total: 0, remaining: 0 };
const cheer = (input: Omit<Parameters<typeof pickCheer>[0], 'terms'>) => pickCheer({ terms: [], ...input });
// 2026-10-28 is a Wednesday.
const wed = (time: string) => at(`2026-10-28T${time}:00`);

describe('pickCheer', () => {
  it('cheers for a midterm within the coming week', () => {
    const tasks = [task({ title: '微積分期中考', kind: 'midterm', dueAt: '2026-11-03T10:00:00+08:00' })];
    expect(cheer({ now: wed('09:00'), classes: none, tasks, events: [] })).toEqual({ key: 'midtermSoon', vars: { title: '微積分期中考', days: 6 } });
    expect(cheer({ now: at('2026-11-02T20:00:00'), classes: none, tasks, events: [] })?.key).toBe('midtermTomorrow');
    expect(cheer({ now: at('2026-11-03T08:00:00'), classes: none, tasks, events: [] })).toEqual({ key: 'examToday', vars: { title: '微積分期中考', time: '10:00' } });
    expect(cheer({ now: at('2026-11-03T13:00:00'), classes: none, tasks, events: [] })?.key).toBe('examDone');
    // More than a week away: no exam cheer yet.
    expect(cheer({ now: at('2026-10-20T09:00:00'), classes: none, tasks, events: [] })).toBeNull();
  });

  it('ignores completed exams that are still ahead and uses final wording for finals', () => {
    const tasks = [
      task({ title: 'A', kind: 'midterm', dueAt: '2026-10-30T10:00:00+08:00', completed: true }),
      task({ title: '經濟期末考', kind: 'final', dueAt: '2026-11-01T10:00:00+08:00' }),
    ];
    expect(cheer({ now: wed('09:00'), classes: none, tasks, events: [] })).toEqual({ key: 'finalSoon', vars: { title: '經濟期末考', days: 4 } });
  });

  it('follows a work shift through the day', () => {
    const events = [event({ title: '咖啡店' })];
    expect(cheer({ now: wed('12:00'), classes: none, tasks: [], events })).toEqual({ key: 'workLater', vars: { time: '18:00' } });
    expect(cheer({ now: wed('19:00'), classes: none, tasks: [], events })).toEqual({ key: 'workNow', vars: { end: '22:00' } });
    expect(cheer({ now: wed('22:30'), classes: { total: 4, remaining: 0 }, tasks: [], events })).toEqual({ key: 'workAndClassesDone', vars: { count: 4 } });
  });

  it('expands weekly shifts to later weeks', () => {
    const events = [event({ startsAt: '2026-10-21T18:00:00+08:00', endsAt: '2026-10-21T22:00:00+08:00', repeat: 'weekly' })];
    expect(cheer({ now: wed('12:00'), classes: none, tasks: [], events })?.key).toBe('workLater');
  });

  it('points at today\'s deadlines before clubs and classes', () => {
    const one = [task({ title: '英文作文', dueAt: '2026-10-28T23:59:00+08:00' })];
    expect(cheer({ now: wed('10:00'), classes: { total: 4, remaining: 4 }, tasks: one, events: [] })).toEqual({ key: 'dueOne', vars: { title: '英文作文' } });
    const two = [...one, task({ title: '報告', kind: 'report', dueAt: '2026-10-28T18:00:00+08:00' })];
    expect(cheer({ now: wed('10:00'), classes: none, tasks: two, events: [] })).toEqual({ key: 'dueMany', vars: { count: 2 } });
  });

  it('mentions club, appointment and study plans', () => {
    const events = [event({ kind: 'club', title: '吉他社', startsAt: '2026-10-28T19:00:00+08:00', endsAt: '2026-10-28T21:00:00+08:00' })];
    expect(cheer({ now: wed('15:00'), classes: none, tasks: [], events })).toEqual({ key: 'club', vars: { title: '吉他社', time: '19:00' } });
  });

  it('thanks a long day of classes and adapts to Fridays and weekends', () => {
    expect(cheer({ now: wed('18:00'), classes: { total: 4, remaining: 0 }, tasks: [], events: [] })).toEqual({ key: 'longDayDone', vars: { count: 4 } });
    expect(cheer({ now: wed('08:00'), classes: { total: 5, remaining: 5 }, tasks: [], events: [] })).toEqual({ key: 'longDayAhead', vars: { count: 5 } });
    expect(cheer({ now: wed('16:00'), classes: { total: 2, remaining: 0 }, tasks: [], events: [] })?.key).toBe('classesDone');
    expect(cheer({ now: at('2026-10-30T17:00:00'), classes: { total: 2, remaining: 0 }, tasks: [], events: [] })?.key).toBe('fridayDone');
    expect(cheer({ now: at('2026-10-31T11:00:00'), classes: none, tasks: [], events: [] })?.key).toBe('weekend');
  });

  it('falls back to the time-of-day line when nothing personal applies', () => {
    expect(cheer({ now: wed('10:00'), classes: { total: 2, remaining: 1 }, tasks: [], events: [] })).toBeNull();
  });

  it('nudges about recently overdue work last', () => {
    const tasks = [task({ dueAt: '2026-10-27T23:59:00+08:00' })];
    expect(cheer({ now: wed('10:00'), classes: { total: 2, remaining: 1 }, tasks, events: [] })).toEqual({ key: 'overdue', vars: { count: 1 } });
  });

  it('uses the official calendar: midterm season before grade upload, then final assessment weeks', () => {
    // 115-1: 期中評量成績上傳 opens 2026-11-09; 期末多元評量週 2026-12-28 – 2027-01-10
    expect(schoolExamCheer('2026-10-25')).toBeNull();
    expect(schoolExamCheer('2026-10-26')).toEqual({ key: 'schoolMidterm' });
    expect(schoolExamCheer('2026-11-08')).toEqual({ key: 'schoolMidterm' });
    expect(schoolExamCheer('2026-11-09')).toBeNull();
    expect(schoolExamCheer('2026-12-21')).toEqual({ key: 'schoolFinalSoon', vars: { days: 7 } });
    expect(schoolExamCheer('2027-01-10')).toEqual({ key: 'schoolFinal' });
    expect(schoolExamCheer('2027-01-11')).toBeNull();
    // 115-2
    expect(schoolExamCheer('2027-04-10')).toEqual({ key: 'schoolMidterm' });
    expect(schoolExamCheer('2027-06-15')).toEqual({ key: 'schoolFinal' });
    expect(ACADEMIC_TERMS.every((t) => t.midtermUploadStart < t.finalStart && t.finalStart <= t.finalEnd)).toBe(true);
  });

  it('puts personal plans before the school season, and the season before generic class lines', () => {
    const now = wed('18:00');
    const dueTonight = [task({ title: '英文作文', dueAt: '2026-10-28T23:59:00+08:00' })];
    expect(pickCheer({ now, classes: none, tasks: dueTonight, events: [] })?.key).toBe('dueOne');
    expect(pickCheer({ now, classes: { total: 4, remaining: 0 }, tasks: [], events: [] })).toEqual({ key: 'schoolMidterm' });
  });
});
