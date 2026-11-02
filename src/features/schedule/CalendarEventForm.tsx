import { useLayoutEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/lib/zod';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { CALENDAR_KINDS, type CalendarEvent } from '@/lib/types';
import type { CalendarEventInput } from '@/lib/data/repository';
import { calendarTime, taipeiDayKey } from '@/lib/studentCalendar';
import { t } from '@/i18n/t';

const iso = (date: string, time: string) => `${date}T${time}:00+08:00`;
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(iso(date, '12:00'))) && taipeiDayKey(new Date(iso(date, '12:00'))) === date;
export const calendarEventSchema = z.object({
  title: z.string().trim().min(1).max(120), kind: z.enum(CALENDAR_KINDS),
  startDate: z.string().refine(validDate), endDate: z.string().refine(validDate),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().max(160), notes: z.string().trim().max(2000), repeat: z.enum(['none', 'weekly']), repeatUntil: z.string(),
}).superRefine((value, context) => {
  const start = Date.parse(iso(value.startDate, value.startTime));
  const end = Date.parse(iso(value.endDate, value.endTime));
  if (!(end > start) || (value.repeat === 'weekly' && end - start > 7 * 86_400_000)) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: t('calendar.invalidRange') });
  }
  if (value.repeatUntil && (!validDate(value.repeatUntil) || value.repeatUntil < value.startDate)) {
    context.addIssue({ code: 'custom', path: ['repeatUntil'], message: t('calendar.invalidRepeat') });
  }
});
type Values = z.infer<typeof calendarEventSchema>;
export function toCalendarEventInput(value: Values, id?: string): CalendarEventInput {
  return { id, title: value.title, kind: value.kind, startsAt: iso(value.startDate, value.startTime), endsAt: iso(value.endDate, value.endTime),
    location: value.location, notes: value.notes, repeat: value.repeat, repeatUntil: value.repeat === 'weekly' ? value.repeatUntil || undefined : undefined };
}
export function CalendarEventForm({ open, date, initial, onClose, onSubmit, saving }: {
  open: boolean; date: string; initial?: CalendarEvent; onClose: () => void; onSubmit: (event: CalendarEventInput) => Promise<void>; saving: boolean;
}) {
  const { register, reset, watch, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(calendarEventSchema) });
  // Initialize before the sheet becomes interactive, so fast mobile typing
  // cannot race a deferred effect that resets the just-entered title.
  useLayoutEffect(() => {
    if (!open) return;
    reset({ title: initial?.title ?? '', kind: initial?.kind ?? 'personal', startDate: initial ? taipeiDayKey(new Date(initial.startsAt)) : date,
      endDate: initial ? taipeiDayKey(new Date(initial.endsAt)) : date, startTime: initial ? calendarTime(initial.startsAt) : '18:00',
      endTime: initial ? calendarTime(initial.endsAt) : '19:00', location: initial?.location ?? '', notes: initial?.notes ?? '',
      repeat: initial?.repeat ?? 'none', repeatUntil: initial?.repeatUntil ?? '' });
  }, [open, date, initial, reset]);
  const repeat = watch('repeat');
  return <Sheet open={open} onClose={onClose} title={t(initial ? 'calendar.editEvent' : 'calendar.addEvent')}
    footer={<><Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="calendar-event-form" className="flex-1" loading={saving}>{t('common.save')}</Button></>}>
    <form id="calendar-event-form" noValidate onSubmit={handleSubmit(async (value) => onSubmit(toCalendarEventInput(value, initial?.id)))} className="grid gap-3">
      <p className="text-caption text-muted">{t('calendar.privateHint')}</p>
      <div><label className="label" htmlFor="event-title">{t('calendar.eventTitle')}</label><input id="event-title" className="field" {...register('title')} aria-invalid={!!errors.title} />{errors.title && <p role="alert" className="text-caption text-danger">{t('calendar.titleRequired')}</p>}</div>
      <div><label className="label" htmlFor="event-kind">{t('calendar.kind')}</label><select id="event-kind" className="field" {...register('kind')}>{CALENDAR_KINDS.map((kind) => <option key={kind} value={kind}>{t(`calendar.kinds.${kind}`)}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-2">
        {(['startDate', 'startTime', 'endDate', 'endTime'] as const).map((field) => <div key={field}><label className="label" htmlFor={`event-${field}`}>{t(`calendar.${field}`)}</label><input id={`event-${field}`} type={field.endsWith('Date') ? 'date' : 'time'} className="field" {...register(field)} aria-invalid={!!errors[field]} />{errors[field] && <p role="alert" className="text-caption text-danger">{t('calendar.invalidRange')}</p>}</div>)}
      </div>
      <div><label className="label" htmlFor="event-location">{t('calendar.location')}</label><input id="event-location" className="field" {...register('location')} maxLength={160} /></div>
      <div><label className="label" htmlFor="event-repeat">{t('calendar.repeat')}</label><select id="event-repeat" className="field" {...register('repeat')}><option value="none">{t('calendar.once')}</option><option value="weekly">{t('calendar.weekly')}</option></select></div>
      {repeat === 'weekly' && <><p className="text-caption text-muted">{t('calendar.seriesHint')}</p><div><label className="label" htmlFor="event-until">{t('calendar.repeatUntil')}</label><input id="event-until" type="date" className="field" {...register('repeatUntil')} />{errors.repeatUntil && <p role="alert" className="text-caption text-danger">{t('calendar.invalidRepeat')}</p>}</div></>}
      <div><label className="label" htmlFor="event-notes">{t('calendar.notes')}</label><textarea id="event-notes" className="field" rows={3} maxLength={2000} {...register('notes')} /></div>
    </form>
  </Sheet>;
}
