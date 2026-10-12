import { Link } from 'react-router-dom';
import { Page } from '@/components/layout/AppShell';
import { useCourses, useNow, useProfile, useTasks } from '@/lib/hooks';
import { useSemester } from '@/app/SemesterProvider';
import { findNextClass, occurrencesOn } from '@/lib/schedule';
import { weekdayOf } from '@/lib/time';
import { filterTasks } from '@/lib/tasks';
import { Hero } from './Hero';
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

  const summary =
    today.length === 0
      ? `今天沒有課${dueToday ? `，有 ${dueToday} 項待辦今天到期` : '，好好安排自己的時間'}。`
      : remaining.length === 0
        ? `今天的 ${today.length} 堂課都上完了${dueToday ? `，還有 ${dueToday} 項待辦今天到期` : ''}。`
        : `今天有 ${today.length} 堂課，還剩 ${remaining.length} 堂${dueToday ? `；${dueToday} 項待辦今天到期` : ''}。`;

  return (
    <Page wide>
      <Hero name={profile.data?.displayName ?? '淡江同學'} now={now} summary={summary} />

      <div className="mt-6 grid gap-6">
        <div className="grid content-start gap-6">
          <NextClassCard next={next} now={now} />

          <section aria-labelledby="today-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="today-title" className="text-h3 text-ink">今日課表</h2>
              <Link to="/schedule" className="text-caption font-semibold text-blue hover:underline">週課表</Link>
            </div>
            {today.length ? (
              <DayTimeline items={today} now={now} />
            ) : (
              <p className="rounded-sm bg-sunken px-4 py-4 text-caption text-muted">今天沒有排課。</p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <TaskSummary tasks={taskList} courses={courseList} now={now} />
          <CampusInfo />
        </div>
      </div>
    </Page>
  );
}
