import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { ErrorNotice } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { useCalendarEvents, useCalendarEventMutations, useTasks } from '@/lib/hooks';
import { calendarItemsOn, dateKey, monthDates, taipeiDayKey, type CalendarItem } from '@/lib/studentCalendar';
import { taipeiDate } from '@/lib/taipei';
import type { CalendarEvent, Course, Semester } from '@/lib/types';
import { COURSE_COLOR_STYLES, WEEKDAY_SHORT } from '@/lib/labels';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';
import { CalendarEventForm } from './CalendarEventForm';

type Mode = 'month' | 'year';
const SOURCES = ['course', 'task', 'personal'] as const;
const DOTS = { course: 'bg-primary', task: COURSE_COLOR_STYLES.amber.bar, personal: COURSE_COLOR_STYLES.teal.bar } as const;

export function StudentCalendar({ mode, onModeChange, courses, semester }: {
  mode: Mode; onModeChange: (mode: Mode) => void; courses: Course[]; semester?: Semester;
}) {
  const today = taipeiDate(new Date());
  const [year, setYear] = useState(today.y);
  const [month, setMonth] = useState(today.m);
  const [selected, setSelected] = useState(taipeiDayKey(new Date()));
  const [filters, setFilters] = useState<CalendarItem['source'][]>([...SOURCES]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent>();
  const [deleting, setDeleting] = useState<CalendarEvent>();
  const eventsQuery = useCalendarEvents();
  const tasksQuery = useTasks();
  const { save, remove } = useCalendarEventMutations();
  const toast = useToast();
  const itemsFor = (date: string) => calendarItemsOn(date, courses, tasksQuery.data ?? [], eventsQuery.data ?? [], semester).filter((item) => filters.includes(item.source));
  const dates = monthDates(year, month);
  const change = (offset: number) => {
    const next = new Date(Date.UTC(year + (mode === 'year' ? offset : 0), month + (mode === 'month' ? offset : 0), 1));
    setYear(next.getUTCFullYear()); setMonth(next.getUTCMonth()); setSelected(next.toISOString().slice(0, 10));
  };
  const edit = (event?: CalendarEvent) => { setEditing(event); setFormOpen(true); };
  const error = eventsQuery.error ?? tasksQuery.error;
  return <section aria-label={t('calendar.title')} className="grid gap-4">
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" aria-label={t('calendar.previous')} onClick={() => change(-1)}><ChevronLeft className="h-4 w-4" /></Button>
      <h2 className="text-h3 font-semibold">{mode === 'year' ? String(year) : t('calendar.monthHeading', { year, month: month + 1 })}</h2>
      <Button variant="ghost" size="sm" aria-label={t('calendar.next')} onClick={() => change(1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => { setYear(today.y); setMonth(today.m); setSelected(taipeiDayKey(new Date())); }}>{t('calendar.today')}</Button>
      <Button size="sm" onClick={() => edit()}><Plus className="h-4 w-4" />{t('calendar.addEvent')}</Button>
    </div>
    <p className="text-caption text-muted">{t('calendar.scopeHint')}</p>
    <div className="flex flex-wrap gap-2" aria-label={t('calendar.filters')}>
      {SOURCES.map((source) => <button key={source} aria-pressed={filters.includes(source)} onClick={() => setFilters((current) => current.includes(source) ? current.filter((value) => value !== source) : [...current, source])}
        className={cn('flex items-center gap-1.5 rounded-full border px-3 py-2 text-label', filters.includes(source) ? 'border-primary text-ink' : 'border-line text-muted')}>
        <span className={cn('h-2 w-2 rounded-full', DOTS[source])} aria-hidden />{t(`calendar.sources.${source}`)}
      </button>)}
    </div>
    {error && <ErrorNotice error={error} onRetry={() => { void eventsQuery.refetch(); void tasksQuery.refetch(); }} />}
    {(eventsQuery.isLoading || tasksQuery.isLoading) && <p role="status">{t('common.loading')}</p>}
    {mode === 'year' ? <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 12 }, (_, currentMonth) => {
        const count = monthDates(year, currentMonth).filter((date) => Number(date.slice(5, 7)) === currentMonth + 1).reduce((sum, date) => sum + itemsFor(date).length, 0);
        const monthDays = monthDates(year, currentMonth).filter((date) => Number(date.slice(5, 7)) === currentMonth + 1);
        const offset = (new Date(Date.UTC(year, currentMonth, 1)).getUTCDay() + 6) % 7;
        return <button key={currentMonth} aria-label={`${t('calendar.monthName', { month: currentMonth + 1 })} ${t('calendar.itemCount', { count })}`} className="rounded-lg border border-line bg-surface p-3 text-left hover:border-primary" onClick={() => { setMonth(currentMonth); setSelected(dateKey(year, currentMonth, 1)); onModeChange('month'); }}>
          <span className="block font-semibold">{t('calendar.monthName', { month: currentMonth + 1 })}</span>
          <span className="my-2 grid grid-cols-7 gap-y-1 text-center text-[10px] text-muted" aria-hidden>
            {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
            {monthDays.map((date) => <span key={date} className={cn('rounded-xs', itemsFor(date).length > 0 && 'bg-primary/10 font-semibold text-primary')}>{Number(date.slice(8))}</span>)}
          </span>
          <span className="text-caption text-muted">{t('calendar.itemCount', { count })}</span>
        </button>;
      })}
    </div> : <>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line py-2 text-center text-label text-muted">{([1, 2, 3, 4, 5, 6, 7] as const).map((day) => <span key={day}>{WEEKDAY_SHORT[day]}</span>)}</div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const items = itemsFor(date);
            const outside = Number(date.slice(5, 7)) !== month + 1;
            return <button key={date} aria-label={t('calendar.dayLabel', { date, count: items.length })} aria-pressed={selected === date}
              className={cn('flex min-h-[72px] min-w-0 flex-col items-center gap-1 border-b border-r border-line px-1 py-2 text-caption', outside && 'text-muted', selected === date && 'bg-primary/10 ring-1 ring-inset ring-primary')}
              onClick={() => { setSelected(date); if (outside) { setYear(Number(date.slice(0, 4))); setMonth(Number(date.slice(5, 7)) - 1); } }}>
              <span className={cn('tabular flex h-6 w-6 items-center justify-center rounded-full', date === taipeiDayKey(new Date()) && 'bg-primary text-white dark:text-[#1A0506]')}>{Number(date.slice(8))}</span>
              <span className="flex gap-1">{SOURCES.filter((source) => items.some((item) => item.source === source)).map((source) => <span key={source} className={cn('h-1.5 w-1.5 rounded-full', DOTS[source])} aria-hidden />)}</span>
              {items.length > 0 && <span className="text-[10px] text-muted">{items.length}</span>}
            </button>;
          })}
        </div>
      </div>
      <h3 className="text-body font-semibold">{selected}</h3>
      {itemsFor(selected).length === 0 ? <p className="rounded-sm bg-sunken p-4 text-caption text-muted">{t('calendar.emptyDay')}</p> : <ul className="grid gap-2">
        {itemsFor(selected).map((item) => <li key={item.id} className="rounded-sm border border-line bg-surface p-3">
          <span className="text-label text-muted">{t(`calendar.sources.${item.source}`)}{item.event && ` · ${t(`calendar.kinds.${item.event.kind}`)}`}</span>
          {item.href ? <Link className="block font-semibold text-link" to={item.href}>{item.title}</Link> : <button className="block text-left font-semibold text-link" onClick={() => edit(item.event)}>{item.title}</button>}
          <p className="tabular text-caption text-muted">{item.time}{item.endTime ? `–${item.endTime}` : ''}{item.location ? ` · ${item.location}` : ''}</p>
          {item.event?.notes && <p className="mt-1 whitespace-pre-wrap break-words text-caption text-muted">{item.event.notes}</p>}
          {item.event && <div className="mt-2 flex gap-3"><Button size="sm" variant="secondary" onClick={() => edit(item.event)}>{t('common.edit')}</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(item.event)}>{t('common.delete')}</Button></div>}
        </li>)}
      </ul>}
    </>}
    <CalendarEventForm open={formOpen} date={selected} initial={editing} saving={save.isPending} onClose={() => setFormOpen(false)} onSubmit={async (input) => {
      try { await save.mutateAsync(input); setFormOpen(false); toast({ tone: 'success', message: t('calendar.saved') }); }
      catch { toast({ tone: 'error', message: t('calendar.saveFailed') }); }
    }} />
    <ConfirmSheet open={Boolean(deleting)} onClose={() => setDeleting(undefined)} title={t('calendar.deleteEvent')} message={t('calendar.deleteHint')} confirmLabel={t('common.delete')} danger loading={remove.isPending} onConfirm={async () => {
      if (!deleting) return;
      try { await remove.mutateAsync(deleting.id); setDeleting(undefined); toast({ tone: 'success', message: t('calendar.deleted') }); }
      catch { toast({ tone: 'error', message: t('calendar.saveFailed') }); }
    }} />
  </section>;
}
