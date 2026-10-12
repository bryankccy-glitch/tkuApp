import { Link } from 'react-router-dom';
import type { Course, Task } from '@/lib/types';
import { filterTasks, upcomingExams, weekProgress } from '@/lib/tasks';
import { formatDue } from '@/lib/time';
import { TASK_KIND_LABELS } from '@/lib/labels';
import { useTaskMutations } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';
import { TaskCheck } from '@/features/tasks/TaskCheck';

export function TaskSummary({ tasks, courses, now }: { tasks: Task[]; courses: Course[]; now: Date }) {
  const { save } = useTaskMutations();
  const overdue = filterTasks(tasks, 'overdue', now);
  const week = filterTasks(tasks, 'week', now).filter((t) => new Date(t.dueAt) >= now);
  const exams = upcomingExams(tasks, now);
  const { done, total } = weekProgress(tasks, now);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const list = [...overdue, ...week.filter((t) => !exams.includes(t))].slice(0, 5);
  const courseName = (id?: string | null) => courses.find((c) => c.id === id)?.name;

  return (
    <section aria-labelledby="tasks-title" className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="tasks-title" className="text-h3 text-ink">{t('summary.title')}</h2>
          <p className="tabular mt-0.5 text-caption text-muted">
            {total ? t('summary.counts', { total, done }) : t('summary.none')}
            {overdue.length > 0 && <span className="text-danger">{t('summary.overdue', { count: overdue.length })}</span>}
          </p>
        </div>
        <Link to="/tasks" className="shrink-0 text-caption font-semibold text-link hover:underline">{t('summary.all')}</Link>
      </div>
      {total > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('summary.progress')}>
          <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}

      {list.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {list.map((t) => {
            const late = new Date(t.dueAt) < now;
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <TaskCheck task={t} onToggle={() => save.mutate({ ...t, completed: !t.completed })} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-ink">{t.title}</p>
                  <p className="truncate text-caption text-muted">
                    {TASK_KIND_LABELS[t.kind]}{courseName(t.courseId) ? `｜${courseName(t.courseId)}` : ''}
                  </p>
                </div>
                <span className={cn('tabular shrink-0 text-caption', late ? 'font-semibold text-danger' : 'text-muted')}>{formatDue(t.dueAt, now)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-caption text-muted">{t('summary.empty')}<Link to="/tasks?add=1" className="font-semibold text-link hover:underline">{t('summary.add')}</Link></p>
      )}

      {exams.length > 0 && (
        <div className="mt-4 rounded-sm bg-heritage/[0.06] p-3">
          <h3 className="text-label text-heritage">{t('summary.exams')}</h3>
          <ul className="mt-1.5 space-y-1">
            {exams.slice(0, 3).map((e) => (
              <li key={e.id} className="flex justify-between gap-3 text-caption">
                <span className="truncate text-ink">{TASK_KIND_LABELS[e.kind]}{t('ai.colon')}{courseName(e.courseId) ?? e.title}</span>
                <span className="tabular shrink-0 text-muted">{formatDue(e.dueAt, now)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
