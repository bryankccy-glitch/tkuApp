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
import { LoadingMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

type View = 'day' | 'week';

export default function SchedulePage() {
  const now = useNow();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { semester } = useSemester();
  const { data: courses = [], isLoading, error, refetch } = useCourses(semester?.id);
  const { save, importMany } = useCourseMutations(semester?.id);
  const today = weekdayOf(now);
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth >= 768 ? 'week' : 'day'));
  const [day, setDay] = useState<Weekday>(today);
  const [importOpen, setImportOpen] = useState(false);
  const formOpen = params.get('add') === '1';
  const closeForm = () => { params.delete('add'); setParams(params, { replace: true }); };

  const conflicts = useMemo(() => findConflicts(courses), [courses]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c) => [c.a.slot.id, c.b.slot.id])), [conflicts]);

  const onCreate = async (v: CourseFormValues) => {
    if (!semester) return;
    try {
      await save.mutateAsync({ ...v, semesterId: semester.id, slots: v.slots.map((s) => ({ ...s, weekday: s.weekday as Weekday, room: s.room.toUpperCase() })) });
      toast({ tone: 'success', message: `已加入「${v.name}」` });
      closeForm();
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : '儲存失敗，請再試一次' });
    }
  };

  const exportCsv = () => {
    downloadText(`TKU課表-${semester?.code ?? ''}.csv`, coursesToCsv(courses), 'text/csv;charset=utf-8');
    toast({ tone: 'success', message: `已匯出 ${courses.length} 門課` });
  };

  const days: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

  return (
    <Page wide>
      <PageHeader
        title="課表"
        subtitle={<SemesterSwitcher />}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />匯入 CSV</Button>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!courses.length}><Download className="h-4 w-4" />匯出 CSV</Button>
            <Button size="sm" onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />新增課程</Button>
          </>
        }
      />

      {conflicts.length > 0 && (
        <div role="alert" className="mb-4 flex gap-2 rounded-sm border border-danger/30 bg-danger/5 p-3 text-caption">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger">有 {conflicts.length} 組課程時間衝突</p>
            <ul className="mt-0.5 text-muted">
              {conflicts.slice(0, 4).map((c, i) => (
                <li key={i}>
                  {WEEKDAY_LABELS[c.a.slot.weekday]}：{c.a.course.name}（{c.a.slot.startTime}–{c.a.slot.endTime}）與 {c.b.course.name}（{c.b.slot.startTime}–{c.b.slot.endTime}）
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
          title="這學期還沒有課程"
          body="手動新增課程，或用 CSV 一次匯入。我們不會要求你提供校務系統帳號密碼。"
          action={<div className="flex gap-2"><Button onClick={() => setParams({ add: '1' })}><Plus className="h-4 w-4" />新增第一門課</Button><Button variant="secondary" onClick={() => setImportOpen(true)}>匯入 CSV</Button></div>}
        />
      ) : (
        <>
          <Segmented<View>
            label="課表檢視"
            className="mb-4 w-fit"
            value={view}
            onChange={setView}
            options={[{ value: 'day', label: '單日' }, { value: 'week', label: '週課表' }]}
          />
          {view === 'week' ? (
            <WeekGrid courses={courses} today={today} conflictSlotIds={conflictIds} />
          ) : (
            <div>
              <div role="tablist" aria-label="選擇星期" className="mb-4 grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const count = occurrencesOn(courses, d).length;
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={day === d}
                      aria-label={`${WEEKDAY_LABELS[d]}，${count} 堂課`}
                      onClick={() => setDay(d)}
                      className={cn('flex flex-col items-center rounded-sm py-2 text-caption font-semibold transition-colors', day === d ? 'bg-navy text-white dark:text-[#0E1B2C]' : 'text-muted hover:bg-sunken')}
                    >
                      <span className={cn(d === today && day !== d && 'text-heritage')}>{WEEKDAY_SHORT[d]}</span>
                      <span className="mt-1 flex h-1.5 gap-0.5">
                        {Array.from({ length: Math.min(count, 4) }).map((_, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', day === d ? 'bg-white/80' : 'bg-navy/40')} />)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {occurrencesOn(courses, day).length ? (
                <DayTimeline items={occurrencesOn(courses, day)} now={day === today ? now : undefined} />
              ) : (
                <EmptyState compact title={`${WEEKDAY_LABELS[day]}沒有課`} />
              )}
            </div>
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
            toast({ tone: 'success', message: `已匯入 ${list.length} 門課` });
          } catch (e) {
            toast({ tone: 'error', message: e instanceof Error ? e.message : '匯入失敗' });
          }
        }}
      />
    </Page>
  );
}
