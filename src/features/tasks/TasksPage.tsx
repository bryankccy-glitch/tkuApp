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
      toast({ tone: 'success', message: editing ? '已儲存變更' : `已新增「${v.title}」` });
      closeForm();
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : '儲存失敗' });
    }
  };

  const toggle = (t: Task) => {
    save.mutate({ ...t, completed: !t.completed }, {
      onSuccess: () => toast({ tone: 'success', message: t.completed ? '已標記為未完成' : '完成了！', action: t.completed ? undefined : { label: '復原', run: () => save.mutate({ ...t, completed: false }) } }),
    });
  };

  const remindIcs = (t: Task) => {
    downloadIcs({ uid: t.id, title: `${TASK_KIND_LABELS[t.kind]}：${t.title}`, start: new Date(t.dueAt), end: new Date(new Date(t.dueAt).getTime() + 30 * 60000), description: t.description, alarmMinutesBefore: t.remindMinutesBefore ?? 0 }, `${t.title}.ics`);
    toast({ tone: 'success', message: '已產生行事曆提醒檔' });
  };

  return (
    <Page>
      <PageHeader title="作業與考試" subtitle="作業、報告、考試與個人任務都在這裡。" actions={<Button size="sm" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />新增</Button>} />
      <Segmented<TaskView>
        label="待辦篩選"
        className="mb-4"
        value={view}
        onChange={setView}
        options={VIEWS.map((v) => ({ value: v, label: TASK_VIEW_LABELS[v], count: v === 'done' || v === 'all' ? undefined : counts[v] }))}
      />

      {isLoading ? <LoadingMark /> : error ? <ErrorNotice error={error} onRetry={refetch} /> : list.length === 0 ? (
        <EmptyState
          title={view === 'overdue' ? '沒有逾期項目' : view === 'done' ? '還沒有完成的項目' : '這裡目前是空的'}
          body={view === 'overdue' ? '很好，全部都在進度內。' : '新增作業或考試，首頁與課表會同步顯示。'}
          action={view !== 'overdue' && view !== 'done' ? <Button onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />新增作業或考試</Button> : undefined}
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
                    {t.priority === 'high' && <span className="text-heritage">優先：{PRIORITY_LABELS[t.priority]}</span>}
                  </p>
                  {t.description && <p className="mt-1 line-clamp-2 text-caption text-muted">{t.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('tabular text-caption', late ? 'font-semibold text-danger' : 'text-muted')}>{formatDue(t.dueAt, now)}</span>
                  <div className="-mr-2 flex">
                    {!t.completed && <IconButton label="加入行事曆提醒" className="h-8 w-8" onClick={() => remindIcs(t)}><BellPlus className="h-4 w-4" /></IconButton>}
                    <IconButton label="編輯" className="h-8 w-8" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label="刪除" className="h-8 w-8 hover:text-danger" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></IconButton>
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
        title="刪除這個待辦？"
        message={deleting ? `「${deleting.title}」刪除後無法復原。` : ''}
        confirmLabel="刪除"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast({ tone: 'success', message: '已刪除' });
          setDeleting(null);
        }}
      />
    </Page>
  );
}
