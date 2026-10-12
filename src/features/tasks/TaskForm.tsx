import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TASK_KINDS, TASK_PRIORITIES, type Course, type Task } from '@/lib/types';
import { PRIORITY_LABELS, TASK_KIND_LABELS } from '@/lib/labels';
import { combineLocal, toDateInput, nowHHMM } from '@/lib/time';

export const taskSchema = z.object({
  title: z.string().trim().min(1, '請輸入標題').max(120, '標題最多 120 字'),
  description: z.string().trim().max(2000, '說明最多 2000 字').optional(),
  kind: z.enum(TASK_KINDS),
  courseId: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '請選擇日期'),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, '請選擇時間'),
  priority: z.enum(TASK_PRIORITIES),
  remind: z.string(),
});
export type TaskFormValues = z.infer<typeof taskSchema>;

const REMIND_OPTIONS = [
  { value: 'none', label: '不提醒' },
  { value: '30', label: '30 分鐘前' },
  { value: '60', label: '1 小時前' },
  { value: '1440', label: '1 天前' },
  { value: '4320', label: '3 天前' },
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
      title={initial ? '編輯待辦' : '新增作業或考試'}
      footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>取消</Button><Button type="submit" form="task-form" className="flex-1" loading={saving}>{initial ? '儲存變更' : '新增'}</Button></>}
    >
      <form id="task-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div>
          <label className="label" htmlFor="t-title">標題</label>
          <input id="t-title" className="field" placeholder="例如：第三章習題" {...register('title')} aria-invalid={!!errors.title} />
          {errors.title && <p className="mt-1 text-caption text-danger">{errors.title.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="t-kind">類型</label>
            <select id="t-kind" className="field" {...register('kind')}>
              {TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-course">關聯課程</label>
            <select id="t-course" className="field" {...register('courseId')}>
              <option value="">不指定</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-date">截止日期</label>
            <input id="t-date" type="date" className="field" {...register('dueDate')} />
            {errors.dueDate && <p className="mt-1 text-caption text-danger">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="t-time">截止時間</label>
            <input id="t-time" type="time" className="field tabular" {...register('dueTime')} />
            {errors.dueTime && <p className="mt-1 text-caption text-danger">{errors.dueTime.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="t-priority">優先程度</label>
            <select id="t-priority" className="field" {...register('priority')}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t-remind">提醒</label>
            <select id="t-remind" className="field" {...register('remind')}>
              {REMIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="t-desc">說明</label>
          <textarea id="t-desc" rows={3} className="field" placeholder="選填" {...register('description')} />
        </div>
      </form>
    </Sheet>
  );
}
