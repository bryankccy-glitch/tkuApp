import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, ErrorNotice, PageHeader, Segmented } from '@/components/ui/misc';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useSemester } from '@/app/SemesterProvider';
import { useCourses, useNow, useTaskMutations, useTasks } from '@/lib/hooks';
import { filterTasks, TASK_VIEW_LABELS, type TaskView } from '@/lib/tasks';
import { formatDue } from '@/lib/time';
import { PRIORITY_LABELS, TASK_KIND_LABELS } from '@/lib/labels';
import { downloadIcs } from '@/lib/ics';
import type { Task } from '@/lib/types';
import { TaskCheck } from './TaskCheck';
import { TaskForm, toTaskInput, type TaskFormValues } from './TaskForm';
import { LoadingMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { t as tx } from '@/i18n/t';

const VIEWS: TaskView[] = ['today', 'week', 'upcoming', 'overdue', 'done', 'all'];

export default function TasksPage() {
  const now = useNow();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { semester } = useSemester();
  const { data: courses = [] } = useCourses(semester?.id);
  const { data: tasks = [], isLoading, error, refetch } = useTasks();
  const { save, remove } = useTaskMutations();
  const [view, setView] = useState<TaskView>('week');
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const adding = params.get('add') === '1';

  const list = useMemo(() => filterTasks(tasks, view, now), [tasks, view, now]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v, filterTasks(tasks, v, now).length])) as Record<TaskView, number>, [tasks, now]);
  const courseName = (id?: string | null) => courses.find((c) => c.id === id)?.name;

  const closeForm = () => { setEditing(null); if (adding) { params.delete('add'); params.delete('course'); setParams(params, { replace: true }); } };

  const submit = async (v: TaskFormValues) => {
    try {
      await save.mutateAsync(toTaskInput(v, editing ?? undefined));
      toast({ tone: 'success', message: editing ? tx('common.saved') : tx('tasks.added', { title: v.title }) });
      closeForm();
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : tx('common.saveFailed') });
    }
  };

  const toggle = (t: Task) => {
    save.mutate({ ...t, completed: !t.completed }, {
      onSuccess: () => toast({ tone: 'success', message: t.completed ? tx('tasks.markedUndone') : tx('tasks.done'), action: t.completed ? undefined : { label: tx('tasks.undo'), run: () => save.mutate({ ...t, completed: false }) } }),
    });
  };

  const remindIcs = (t: Task) => {
    downloadIcs({ uid: t.id, title: `${TASK_KIND_LABELS[t.kind]}：${t.title}`, start: new Date(t.dueAt), end: new Date(new Date(t.dueAt).getTime() + 30 * 60000), description: t.description, alarmMinutesBefore: t.remindMinutesBefore ?? 0 }, `${t.title}.ics`);
    toast({ tone: 'success', message: tx('tasks.icsToast') });
  };

  return (
    <Page>
      <PageHeader title={tx('tasks.title')} subtitle={tx('tasks.subtitle')} actions={<Button size="sm" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />{tx('tasks.add')}</Button>} />
      <Segmented<TaskView>
        label={tx('tasks.filter')}
        className="mb-4"
        value={view}
        onChange={setView}
        options={VIEWS.map((v) => ({ value: v, label: TASK_VIEW_LABELS[v], count: v === 'done' || v === 'all' ? undefined : counts[v] }))}
      />

      {isLoading ? <LoadingMark /> : error ? <ErrorNotice error={error} onRetry={refetch} /> : list.length === 0 ? (
        <EmptyState
          title={view === 'overdue' ? tx('tasks.emptyOverdue') : view === 'done' ? tx('tasks.emptyDone') : tx('tasks.empty')}
          body={view === 'overdue' ? tx('tasks.emptyOverdueBody') : tx('tasks.emptyBody')}
          action={view !== 'overdue' && view !== 'done' ? <Button onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />{tx('summary.add')}</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {list.map((t) => {
            const late = !t.completed && new Date(t.dueAt) < now;
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="pt-0.5"><TaskCheck task={t} onToggle={() => toggle(t)} /></div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-body font-semibold', t.completed ? 'text-muted line-through' : 'text-ink')}>{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-caption text-muted">
                    <span className={cn(['quiz', 'midterm', 'final'].includes(t.kind) && 'font-semibold text-heritage')}>{TASK_KIND_LABELS[t.kind]}</span>
                    {courseName(t.courseId) && <span>{courseName(t.courseId)}</span>}
                    {t.priority === 'high' && <span className="text-heritage">{tx('tasks.priorityLine', { p: PRIORITY_LABELS[t.priority] })}</span>}
                  </p>
                  {t.description && <p className="mt-1 line-clamp-2 text-caption text-muted">{t.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('tabular text-caption', late ? 'font-semibold text-danger' : 'text-muted')}>{formatDue(t.dueAt, now)}</span>
                  <div className="-mr-2 flex">
                    {!t.completed && <IconButton label={tx('tasks.calendar')} className="h-8 w-8" onClick={() => remindIcs(t)}><BellPlus className="h-4 w-4" /></IconButton>}
                    <IconButton label={tx('common.edit')} className="h-8 w-8" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label={tx('common.delete')} className="h-8 w-8 hover:text-danger" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskForm open={adding || !!editing} onClose={closeForm} initial={editing} courses={courses} onSubmit={submit} saving={save.isPending} defaultCourseId={params.get('course') ?? undefined} />
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={tx('tasks.deleteTitle')}
        message={deleting ? tx('tasks.deleteBody', { title: deleting.title }) : ''}
        confirmLabel={tx('common.delete')}
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast({ tone: 'success', message: tx('tasks.deleted') });
          setDeleting(null);
        }}
      />
    </Page>
  );
}
