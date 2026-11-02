import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { courseSchema, type CourseFormInput, CourseFormValues } from './courseSchema';
import { COURSE_COLORS, type Course, type Weekday } from '@/lib/types';
import { COURSE_COLOR_STYLES, WEEKDAY_LABELS } from '@/lib/labels';
import { TKU_PERIODS, periodRangeToTimes } from '@/lib/periods';
import { conflictsFor } from '@/lib/schedule';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

const blankSlot = { weekday: 1 as Weekday, startTime: '08:10', endTime: '10:00', room: '' };

export function CourseForm({
  open, onClose, initial, courses, onSubmit, saving,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Course | null;
  courses: Course[];
  onSubmit: (v: CourseFormValues) => void;
  saving?: boolean;
}) {
  const form = useForm<CourseFormInput, unknown, CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: '', code: '', instructor: '', color: 'navy', notes: '', slots: [blankSlot] },
  });
  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'slots' });

  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? { name: initial.name, code: initial.code ?? '', instructor: initial.instructor ?? '', color: initial.color, notes: initial.notes ?? '', slots: initial.slots.map((s) => ({ ...s })) }
        : { name: '', code: '', instructor: '', color: 'navy', notes: '', slots: [blankSlot] },
    );
  }, [open, initial, reset]);

  const slots = useWatch({ control, name: 'slots' });
  const color = useWatch({ control, name: 'color' });
  const conflicts = useMemo(() => {
    const valid = (slots ?? []).filter((s) => s.startTime && s.endTime && s.startTime < s.endTime);
    return conflictsFor({ id: initial?.id ?? '__new__', slots: valid.map((s, i) => ({ ...s, id: String(i), weekday: Number(s.weekday) as Weekday })) }, courses);
  }, [slots, courses, initial]);

  const applyPeriods = (index: number, from: number, to: number) => {
    const t = periodRangeToTimes(from, to);
    if (!t) return;
    setValue(`slots.${index}.startTime`, t.startTime, { shouldValidate: true });
    setValue(`slots.${index}.endTime`, t.endTime, { shouldValidate: true });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? t('course.edit') : t('course.add')}
      description={t('course.formHint')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="course-form" className="flex-1" loading={saving}>{initial ? t('common.save') : t('course.addToSchedule')}</Button>
        </>
      }
    >
      <form id="course-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div>
          <label className="label" htmlFor="c-name">{t('course.name')}</label>
          <input id="c-name" className="field" placeholder={t('course.namePlaceholder')} {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="mt-1 text-caption text-danger">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-instructor">{t('course.instructor')}</label>
            <input id="c-instructor" className="field" placeholder={t('common.optional')} {...register('instructor')} />
          </div>
          <div>
            <label className="label" htmlFor="c-code">{t('course.code')}</label>
            <input id="c-code" className="field" placeholder={t('common.optional')} {...register('code')} />
          </div>
        </div>

        <fieldset>
          <legend className="label">{t('course.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" value={c} {...register('color')} className="peer sr-only" />
                <span className={cn('flex h-9 items-center gap-2 rounded-full border px-3 text-caption font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-link', color === c ? 'border-ink text-ink' : 'border-line text-muted')}>
                  <span className={cn('h-3 w-3 rounded-full', COURSE_COLOR_STYLES[c].bar)} aria-hidden />
                  {COURSE_COLOR_STYLES[c].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="label">{t('course.slots')}</legend>
          {fields.map((f, i) => {
            const e = errors.slots?.[i];
            return (
              <div key={f.id} className="rounded-sm border border-line p-3">
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <div>
                    <label className="label" htmlFor={`s-day-${i}`}>{t('course.weekday')}</label>
                    <select id={`s-day-${i}`} className="field" {...register(`slots.${i}.weekday`)}>
                      {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`s-room-${i}`}>{t('course.room')}</label>
                    <input id={`s-room-${i}`} className="field uppercase" placeholder="E304" {...register(`slots.${i}.room`)} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`s-start-${i}`}>{t('course.start')}</label>
                    <input id={`s-start-${i}`} type="time" className="field tabular" {...register(`slots.${i}.startTime`)} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`s-end-${i}`}>{t('course.end')}</label>
                    <input id={`s-end-${i}`} type="time" className="field tabular" {...register(`slots.${i}.endTime`)} aria-invalid={!!e?.endTime} />
                  </div>
                </div>
                {e?.endTime && <p className="mt-1 text-caption text-danger">{e.endTime.message}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PeriodPicker onPick={(a, b) => applyPeriods(i, a, b)} idx={i} />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="ml-auto inline-flex items-center gap-1 text-caption text-danger hover:underline">
                      <Trash2 className="h-3.5 w-3.5" />{t('course.removeSlot')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {errors.slots?.root && <p className="text-caption text-danger">{errors.slots.root.message}</p>}
          <button type="button" onClick={() => append({ ...blankSlot })} className="inline-flex items-center gap-1.5 justify-self-start text-caption font-semibold text-link hover:underline">
            <Plus className="h-4 w-4" />{t('course.addSlot')}
          </button>
        </fieldset>

        {conflicts.length > 0 && (
          <div role="alert" className="flex gap-2 rounded-sm border border-warning/40 bg-warning/10 p-3 text-caption text-ink">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-semibold">{t('course.overlap')}</p>
              <ul className="mt-0.5 text-muted">
                {conflicts.map((c) => (
                  <li key={c.slot.id}>{c.course.name}（{WEEKDAY_LABELS[c.slot.weekday]} {c.slot.startTime}–{c.slot.endTime}）</li>
                ))}
              </ul>
              <p className="mt-1 text-muted">{t('course.overlapNote')}</p>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="c-notes">{t('course.notes')}</label>
          <textarea id="c-notes" rows={3} className="field" placeholder={t('course.notesPlaceholder')} {...register('notes')} />
          {errors.notes && <p className="mt-1 text-caption text-danger">{errors.notes.message}</p>}
        </div>
      </form>
    </Sheet>
  );
}

function PeriodPicker({ onPick, idx }: { onPick: (a: number, b: number) => void; idx: number }) {
  return (
    <div className="flex items-center gap-1.5 text-caption text-muted">
      <label htmlFor={`p-from-${idx}`}>{t('course.periodFrom')}</label>
      <select
        id={`p-from-${idx}`}
        className="rounded-xs border border-line bg-surface px-1.5 py-1 text-ink"
        defaultValue=""
        onChange={(e) => {
          const from = Number(e.target.value);
          const toSel = document.getElementById(`p-to-${idx}`) as HTMLSelectElement | null;
          const to = Math.max(from, Number(toSel?.value || from));
          if (from) onPick(from, to);
        }}
      >
        <option value="" disabled>–</option>
        {TKU_PERIODS.map((p) => <option key={p.no} value={p.no}>{p.no}</option>)}
      </select>
      <label htmlFor={`p-to-${idx}`}>{t('course.periodTo')}</label>
      <select
        id={`p-to-${idx}`}
        className="rounded-xs border border-line bg-surface px-1.5 py-1 text-ink"
        defaultValue=""
        onChange={(e) => {
          const to = Number(e.target.value);
          const fromSel = document.getElementById(`p-from-${idx}`) as HTMLSelectElement | null;
          const from = Math.min(to, Number(fromSel?.value || to));
          if (to) onPick(from, to);
        }}
      >
        <option value="" disabled>–</option>
        {TKU_PERIODS.map((p) => <option key={p.no} value={p.no}>{p.no}</option>)}
      </select>
      {t('course.periodSuffix') && <span>{t('course.periodSuffix')}</span>}
    </div>
  );
}
