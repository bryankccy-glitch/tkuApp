import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Plus, Upload } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { PageHeader, Segmented, EmptyState, ErrorNotice } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useSemester } from '@/app/SemesterProvider';
import { useCourseMutations, useCourses, useNow } from '@/lib/hooks';
import { findConflicts, occurrencesOn } from '@/lib/schedule';
import { weekdayOf } from '@/lib/time';
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from '@/lib/labels';
import { coursesToCsv } from '@/lib/csv';
import { downloadText } from '@/lib/ics';
import type { Weekday } from '@/lib/types';
import { WeekGrid } from './WeekGrid';
import { DayTimeline } from './DayTimeline';
import { CourseForm } from './CourseForm';
import type { CourseFormValues } from './courseSchema';
import { CsvImport } from './CsvImport';
import { SemesterSwitcher } from './SemesterSwitcher';
import { FriendsPanel } from '@/features/friends/FriendsPanel';
import { useFriends } from '@/lib/social/hooks';
import { LoadingMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

type View = 'day' | 'week';
type Tab = 'mine' | 'friends';

export default function SchedulePage() {
  const now = useNow();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { semester } = useSemester();
  const { data: courses = [], isLoading, error, refetch } = useCourses(semester?.id);
  const { save, importMany } = useCourseMutations(semester?.id);
  const today = weekdayOf(now);
  const [view, setView] = useState<View>('day');
  const [day, setDay] = useState<Weekday>(today);
  const [importOpen, setImportOpen] = useState(false);
  const formOpen = params.get('add') === '1';
  const tab: Tab = params.get('tab') === 'friends' ? 'friends' : 'mine';
  const setTab = (next: Tab) => {
    if (next === 'friends') params.set('tab', 'friends'); else { params.delete('tab'); params.delete('code'); }
    setParams(params, { replace: true });
  };
  const incoming = (useFriends().data ?? []).filter((f) => f.direction === 'incoming').length;
  const closeForm = () => { params.delete('add'); setParams(params, { replace: true }); };

  const conflicts = useMemo(() => findConflicts(courses), [courses]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c) => [c.a.slot.id, c.b.slot.id])), [conflicts]);

  const onCreate = async (v: CourseFormValues) => {
    if (!semester) return;
    try {
      await save.mutateAsync({ ...v, semesterId: semester.id, slots: v.slots.map((s) => ({ ...s, weekday: s.weekday as Weekday, room: s.room.toUpperCase() })) });
      toast({ tone: 'success', message: t('schedule.added', { name: v.name }) });
      closeForm();
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : t('common.saveFailed') });
    }
  };

  const exportCsv = () => {
    downloadText(t('schedule.csvFile', { code: semester?.code ?? '' }), coursesToCsv(courses), 'text/csv;charset=utf-8');
    toast({ tone: 'success', message: t('schedule.exported', { count: courses.length }) });
  };

  const days: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

  return (
    <Page wide>
      <PageHeader
        title={t('schedule.title')}
        subtitle={<SemesterSwitcher />}
        actions={tab === 'friends' ? undefined :
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />{t('common.importCsv')}</Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!courses.length}><Download className="h-4 w-4" />{t('common.exportCsv')}</Button>
            <Button size="sm" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />{t('schedule.addCourse')}</Button>
          </>
        }
      />

      <Segmented<Tab>
        label={t('friends.tabsLabel')}
        className="mb-4 [&>button]:flex-1 [&>button]:justify-center"
        value={tab}
        onChange={setTab}
        options={[{ value: 'mine', label: t('friends.tabMine') }, { value: 'friends', label: t('friends.tabFriends'), count: incoming }]}
      />

      {tab === 'friends' ? (
        <FriendsPanel myCourses={courses} semesterCode={semester?.code} initialCode={params.get('code')} />
      ) : (
      <>
      {conflicts.length > 0 && (
        <div role="alert" className="mb-4 flex gap-2 rounded-sm border border-danger/30 bg-danger/5 p-3 text-caption">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger">{t('schedule.conflicts', { count: conflicts.length })}</p>
            <ul className="mt-0.5 text-muted">
              {conflicts.slice(0, 4).map((c, i) => (
                <li key={i}>
                  {t('schedule.conflictLine', { day: WEEKDAY_LABELS[c.a.slot.weekday], a: c.a.course.name, aStart: c.a.slot.startTime, aEnd: c.a.slot.endTime, b: c.b.course.name, bStart: c.b.slot.startTime, bEnd: c.b.slot.endTime })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingMark />
      ) : error ? (
        <ErrorNotice error={error} onRetry={refetch} />
      ) : courses.length === 0 ? (
        <EmptyState
          title={t('schedule.emptyTitle')}
          body={t('schedule.emptyBody')}
          action={<div className="flex gap-2"><Button onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />{t('schedule.addFirst')}</Button><Button variant="secondary" onClick={() => setImportOpen(true)}>{t('common.importCsv')}</Button></div>}
        />
      ) : (
        <>
          <Segmented<View>
            label={t('schedule.view')}
            className="mb-4 w-fit"
            value={view}
            onChange={setView}
            options={[{ value: 'day', label: t('schedule.day') }, { value: 'week', label: t('schedule.week') }]}
          />
          {view === 'week' ? (
            <WeekGrid courses={courses} today={today} conflictSlotIds={conflictIds} />
          ) : (
            <div>
              <div role="tablist" aria-label={t('schedule.pickDay')} className="mb-4 grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const count = occurrencesOn(courses, d).length;
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={day === d}
                      aria-label={t('schedule.dayCount', { day: WEEKDAY_LABELS[d], count })}
                      onClick={() => setDay(d)}
                      className={cn('flex flex-col items-center rounded-sm py-2 text-caption font-semibold transition-colors', day === d ? 'bg-primary text-white dark:text-[#1A0506]' : 'text-muted hover:bg-sunken')}
                    >
                      <span className={cn(d === today && day !== d && 'text-heritage')}>{WEEKDAY_SHORT[d]}</span>
                      <span className="mt-1 flex h-1.5 gap-0.5">
                        {Array.from({ length: Math.min(count, 4) }).map((_, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', day === d ? 'bg-white/80' : 'bg-primary/40')} />)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {occurrencesOn(courses, day).length ? (
                <DayTimeline items={occurrencesOn(courses, day)} now={day === today ? now : undefined} />
              ) : (
                <EmptyState compact title={t('schedule.noClassesOn', { day: WEEKDAY_LABELS[day] })} />
              )}
            </div>
          )}
        </>
      )}
      </>
      )}

      <CourseForm open={formOpen} onClose={closeForm} courses={courses} onSubmit={onCreate} saving={save.isPending} />
      <CsvImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        importing={importMany.isPending}
        onImport={async (list) => {
          try {
            await importMany.mutateAsync(list);
            toast({ tone: 'success', message: t('schedule.imported', { count: list.length }) });
          } catch (e) {
            toast({ tone: 'error', message: e instanceof Error ? e.message : t('schedule.importFailed') });
          }
        }}
      />
    </Page>
  );
}
