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
import { LoadingMark } from '@/components/brand/Logo';

export default function DashboardPage() {
  const now = useNow();
  const { semester } = useSemester();
  const profile = useProfile();
  const courses = useCourses(semester?.id);
  const tasks = useTasks();

  if (courses.isLoading || tasks.isLoading || profile.isLoading) return <LoadingMark />;
  if (courses.error || tasks.error) return <Page><ErrorNotice error={courses.error ?? tasks.error} onRetry={() => { courses.refetch(); tasks.refetch(); }} /></Page>;

  const courseList = courses.data ?? [];
  const taskList = tasks.data ?? [];
  const today = occurrencesOn(courseList, weekdayOf(now));
  const remaining = today.filter((o) => o.slot.endTime > `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const dueToday = filterTasks(taskList, 'today', now).length;
  const next = findNextClass(courseList, now);

  return (
    <>
      <Hero name={profile.data?.displayName ?? '淡江同學'} summary={{ total: today.length, remaining: remaining.length, dueToday }} />
      <QuickActions />
      <Page className="pt-5">
        <div className="grid gap-6">
          <div className="scroll-mt-4" id="next-class-anchor">
            <NextClassCard next={next} now={now} />
          </div>

          <section aria-labelledby="today-title" className="scroll-mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="today-title" className="text-h3 text-ink">今日課表</h2>
              <Link to="/schedule" className="text-caption font-semibold text-link hover:underline">週課表</Link>
            </div>
            {today.length ? (
              <DayTimeline items={today} now={now} />
            ) : (
              <p className="rounded-sm bg-sunken px-4 py-4 text-caption text-muted">今天沒有排課。</p>
            )}
          </section>

          <TaskSummary tasks={taskList} courses={courseList} now={now} />
          <CampusInfo />
        </div>
      </Page>
    </>
  );
}
