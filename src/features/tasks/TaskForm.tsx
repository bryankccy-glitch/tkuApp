import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TASK_KINDS, TASK_PRIORITIES, type Course, type Task } from '@/lib/types';
import { PRIORITY_LABELS, TASK_KIND_LABELS } from '@/lib/labels';
import { combineLocal, toDateInput, nowHHMM } from '@/lib/time';
import { t } from '@/i18n/t';

export const taskSchema = z.object({
  title: z.string().trim().min(1, t('taskForm.titleRequired')).max(120, t('taskForm.titleMax')),
  description: z.string().trim().max(2000, t('taskForm.descMax')).optional(),
  kind: z.enum(TASK_KINDS),
  courseId: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('taskForm.pickDate')),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, t('taskForm.pickTime')),
  priority: z.enum(TASK_PRIORITIES),
  remind: z.string(),
});
export type TaskFormValues = z.infer<typeof taskSchema>;

const REMIND_OPTIONS = [
  { value: 'none', label: 'taskForm.remindNone' },
  { value: '30', label: 'taskForm.remind30' },
  { value: '60', label: 'taskForm.remind60' },
  { value: '1440', label: 'taskForm.remind1440' },
  { value: '4320', label: 'taskForm.remind4320' },
];

export function toTaskInput(v: TaskFormValues, prev?: Task) {
  return {
    id: prev?.id,
    title: v.title,
    description: v.description || undefined,
    kind: v.kind,
    courseId: v.courseId || null,
    dueAt: combineLocal(v.dueDate, v.dueTime),
    priority: v.priority,
    completed: prev?.completed ?? false,
    completedAt: prev?.completedAt ?? null,
    remindMinutesBefore: v.remind === 'none' ? null : Number(v.remind),
  };
}

export function TaskForm({
  open, onClose, initial, courses, onSubmit, saving, defaultCourseId,
}: {
  open: boolean; onClose: () => void; initial?: Task | null; courses: Course[]; onSubmit: (v: TaskFormValues) => void; saving?: boolean; defaultCourseId?: string;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema) });

  useEffect(() => {
    if (!open) return;
    const due = initial ? new Date(initial.dueAt) : (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d; })();
    reset({
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      kind: initial?.kind ?? 'homework',
      courseId: initial?.courseId ?? defaultCourseId ?? '',
      dueDate: toDateInput(due),
      dueTime: nowHHMM(due),
      priority: initial?.priority ?? 'medium',
      remind: initial ? (initial.remindMinutesBefore === null ? 'none' : String(initial.remindMinutesBefore)) : '1440',
    });
  }, [open, initial, reset, defaultCourseId]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? t('taskForm.edit') : t('taskForm.add')}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="task-form" className="flex-1" loading={saving}>{initial ? t('common.save') : t('tasks.add')}</Button></>}
    >
      <form id="task-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div>
          <label className="label" htmlFor="t-title">{t('taskForm.title')}</label>
          <input id="t-title" className="field" placeholder={t('taskForm.titlePlaceholder')} {...register('title')} aria-invalid={!!errors.title} />
          {errors.title && <p className="mt-1 text-caption text-danger">{errors.title.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-kind">{t('taskForm.kind')}</label>
            <select id="t-kind" className="field" {...register('kind')}>
              {TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-course">{t('taskForm.course')}</label>
            <select id="t-course" className="field" {...register('courseId')}>
              <option value="">{t('taskForm.noCourse')}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-date">{t('taskForm.dueDate')}</label>
            <input id="t-date" type="date" className="field" {...register('dueDate')} />
            {errors.dueDate && <p className="mt-1 text-caption text-danger">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="t-time">{t('taskForm.dueTime')}</label>
            <input id="t-time" type="time" className="field tabular" {...register('dueTime')} />
            {errors.dueTime && <p className="mt-1 text-caption text-danger">{errors.dueTime.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="t-priority">{t('taskForm.priority')}</label>
            <select id="t-priority" className="field" {...register('priority')}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-remind">{t('taskForm.remind')}</label>
            <select id="t-remind" className="field" {...register('remind')}>
              {REMIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="t-desc">{t('taskForm.desc')}</label>
          <textarea id="t-desc" rows={3} className="field" placeholder={t('common.optional')} {...register('description')} />
        </div>
      </form>
    </Sheet>
  );
}
