import { Link } from 'react-router-dom';
import { Page } from '@/components/layout/AppShell';
import { useCourses, useNow, useProfile, useTasks } from '@/lib/hooks';
import { useSemester } from '@/app/SemesterProvider';
import { findNextClass, occurrencesOn } from '@/lib/schedule';
import { weekdayOf } from '@/lib/time';
import { filterTasks } from '@/lib/tasks';
import { Hero, QuickActions } from './Hero';
import { NextClassCard } from './NextClass';
import { TaskSummary } from './TaskSummary';
import { CampusInfo } from './CampusInfo';
import { DayTimeline } from '@/features/schedule/DayTimeline';
import { ErrorNotice } from '@/components/ui/misc';
import { t } from '@/i18n/t';

export default function DashboardPage() {
  const now = useNow();
  const { semester } = useSemester();
  const profile = useProfile();
  const courses = useCourses(semester?.id);
  const tasks = useTasks();

  // Show the hero (scene + weather) immediately; only the personal sections wait for data.
  if (courses.isLoading || tasks.isLoading || profile.isLoading) {
    return (
      <>
        <Hero name={profile.data?.displayName} />
        <QuickActions />
        <Page className="pt-5">
          <DashboardSkeleton />
        </Page>
      </>
    );
  }
  if (courses.error || tasks.error) return <Page><ErrorNotice error={courses.error ?? tasks.error} onRetry={() => { courses.refetch(); tasks.refetch(); }} /></Page>;

  const courseList = courses.data ?? [];
  const taskList = tasks.data ?? [];
  const today = occurrencesOn(courseList, weekdayOf(now));
  const remaining = today.filter((o) => o.slot.endTime > `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const dueToday = filterTasks(taskList, 'today', now).length;
  const next = findNextClass(courseList, now);

  return (
    <>
      <Hero name={profile.data?.displayName ?? t('defaults.studentName')} summary={{ total: today.length, remaining: remaining.length, dueToday }} />
      <QuickActions />
      <Page className="pt-5">
        <div className="grid gap-6">
          <div className="scroll-mt-4" id="next-class-anchor">
            <NextClassCard next={next} now={now} />
          </div>

          <section aria-labelledby="today-title" className="scroll-mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="today-title" className="text-h3 text-ink">{t('home.todayClasses')}</h2>
              <Link to="/schedule" className="text-caption font-semibold text-link hover:underline">{t('home.weekView')}</Link>
            </div>
            {today.length ? (
              <DayTimeline items={today} now={now} />
            ) : (
              <p className="rounded-sm bg-sunken px-4 py-4 text-caption text-muted">{t('home.noClassesToday')}</p>
            )}
          </section>

          <TaskSummary tasks={taskList} courses={courseList} now={now} />
          <CampusInfo />
        </div>
      </Page>
    </>
  );
}

/** Placeholder blocks shaped like the real sections, so the page doesn't jump when data arrives. */
function DashboardSkeleton() {
  const block = 'rounded-lg bg-sunken motion-safe:animate-pulse';
  return (
    <div role="status" aria-label={t('common.loading')} className="grid gap-6">
      <div className={`${block} h-[116px]`} />
      <div className="grid gap-3">
        <div className="h-5 w-28 rounded-full bg-sunken motion-safe:animate-pulse" />
        <div className={`${block} h-[68px]`} />
        <div className={`${block} h-[68px]`} />
      </div>
      <div className="grid gap-3">
        <div className="h-5 w-24 rounded-full bg-sunken motion-safe:animate-pulse" />
        <div className={`${block} h-[96px]`} />
      </div>
    </div>
  );
}
