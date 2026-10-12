import { describe, expect, it } from 'vitest';
import { filterTasks, upcomingExams, weekProgress } from '../tasks';
import type { Task } from '../types';

const now = new Date(2026, 9, 14, 12, 0); // Wed
const t = (id: string, due: Date, extra: Partial<Task> = {}): Task => ({
  id, title: id, kind: 'homework', dueAt: due.toISOString(), priority: 'medium', completed: false,
  remindMinutesBefore: null, createdAt: '', updatedAt: '', ...extra,
});
const tasks = [
  t('overdue', new Date(2026, 9, 13, 23, 59)),
  t('today', new Date(2026, 9, 14, 18, 0)),
  t('fri', new Date(2026, 9, 16, 9, 0)),
  t('nextweek', new Date(2026, 9, 21, 9, 0), { kind: 'midterm' }),
  t('done', new Date(2026, 9, 15, 9, 0), { completed: true }),
];

describe('task views', () => {
  it('splits by today / overdue / done', () => {
    expect(filterTasks(tasks, 'today', now).map((x) => x.id)).toEqual(['today']);
    expect(filterTasks(tasks, 'overdue', now).map((x) => x.id)).toEqual(['overdue']);
    expect(filterTasks(tasks, 'done', now).map((x) => x.id)).toEqual(['done']);
  });
  it('week view covers Monday–Sunday', () => {
    expect(filterTasks(tasks, 'week', now).map((x) => x.id)).toEqual(['overdue', 'today', 'fri']);
  });
  it('upcoming exams within window', () => {
    expect(upcomingExams(tasks, now, 14).map((x) => x.id)).toEqual(['nextweek']);
    expect(upcomingExams(tasks, now, 3)).toHaveLength(0);
  });
  it('week progress counts completed', () => {
    expect(weekProgress(tasks, now)).toEqual({ done: 1, total: 4 });
  });
});
