import type { Task } from './types';
import { addDays, startOfDay, startOfWeek } from './time';
import { EXAM_KINDS } from './labels';
import i18n from '@/i18n';

export type TaskView = 'today' | 'week' | 'upcoming' | 'overdue' | 'done' | 'all';

export const TASK_VIEW_LABELS = new Proxy({} as Record<TaskView, string>, { get: (_t, k) => (typeof k === 'string' ? i18n.t(`taskView.${k}`) : undefined) });

const byDue = (a: Task, b: Task) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();

export function filterTasks(tasks: Task[], view: TaskView, now: Date): Task[] {
  const t0 = startOfDay(now).getTime();
  const t1 = addDays(startOfDay(now), 1).getTime();
  const w0 = startOfWeek(now).getTime();
  const w1 = addDays(startOfWeek(now), 7).getTime();
  const n = now.getTime();
  const due = (t: Task) => new Date(t.dueAt).getTime();
  switch (view) {
    case 'today':
      return tasks.filter((t) => !t.completed && due(t) >= t0 && due(t) < t1).sort(byDue);
    case 'week':
      return tasks.filter((t) => !t.completed && due(t) >= w0 && due(t) < w1).sort(byDue);
    case 'upcoming':
      return tasks.filter((t) => !t.completed && due(t) >= n && due(t) < n + 72 * 3600_000).sort(byDue);
    case 'overdue':
      return tasks.filter((t) => !t.completed && due(t) < n).sort(byDue);
    case 'done':
      return tasks.filter((t) => t.completed).sort((a, b) => byDue(b, a));
    case 'all':
      return [...tasks].sort(byDue);
  }
}

export function upcomingExams(tasks: Task[], now: Date, days = 14): Task[] {
  const n = now.getTime();
  return tasks
    .filter((t) => !t.completed && EXAM_KINDS.includes(t.kind) && new Date(t.dueAt).getTime() >= n && new Date(t.dueAt).getTime() < n + days * 86400_000)
    .sort(byDue);
}

/** Completion ratio for tasks due this week (including completed ones). */
export function weekProgress(tasks: Task[], now: Date): { done: number; total: number } {
  const w0 = startOfWeek(now).getTime();
  const w1 = addDays(startOfWeek(now), 7).getTime();
  const inWeek = tasks.filter((t) => new Date(t.dueAt).getTime() >= w0 && new Date(t.dueAt).getTime() < w1);
  return { done: inWeek.filter((t) => t.completed).length, total: inWeek.length };
}
