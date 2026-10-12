import { useEffect, useRef } from 'react';
import { useSemester } from '@/app/SemesterProvider';
import { useCourses, useTasks } from '@/lib/hooks';
import { markFired, notificationSupport, readFired, readPrefs, remindersBetween, showReminder } from '@/services/reminders';

const TICK_MS = 30_000;
/** Reminders missed by more than this (e.g. phone asleep) are skipped instead of firing late. */
const GRACE_MS = 5 * 60_000;

/** Checks every 30 s for due reminders while the app is running. Mounted once in the app shell. */
export function useReminderScheduler() {
  const { semester } = useSemester();
  const { data: courses = [] } = useCourses(semester?.id);
  const { data: tasks = [] } = useTasks();
  const data = useRef({ courses, tasks });
  data.current = { courses, tasks };

  useEffect(() => {
    const tick = () => {
      const prefs = readPrefs();
      if (!prefs.enabled || notificationSupport() !== 'granted') return;
      const now = Date.now();
      const fired = readFired();
      const due = remindersBetween(data.current.courses, data.current.tasks, prefs, now - GRACE_MS, now + 1);
      for (const r of due) {
        if (fired[r.id]) continue;
        markFired(r.id, now);
        void showReminder(r);
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    const onVis = () => !document.hidden && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
