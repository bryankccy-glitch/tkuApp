import { useEffect, useRef } from 'react';
import { useSemester } from '@/app/SemesterProvider';
import { useCourses, useTasks } from '@/lib/hooks';
import { markFired, notificationSupport, readFired, readPrefs, remindersBetween, showReminder } from '@/services/reminders';
import { useAuth } from '@/app/AuthProvider';
import { pushAvailable, savePushSubscription } from '@/services/pushSubscription';
import { writePrefs } from '@/services/reminders';

const TICK_MS = 30_000;
/** Reminders missed by more than this (e.g. phone asleep) are skipped instead of firing late. */
const GRACE_MS = 5 * 60_000;

/** Checks every 30 s for due reminders while the app is running. Mounted once in the app shell. */
export function useReminderScheduler() {
  const { mode, session } = useAuth();
  const userId = mode === 'cloud' ? session?.user.id : undefined;
  // Upgrade old "enabled" local preferences, and repair expired/missing server subscriptions.
  // Never request notification permission automatically; only reconnect already-granted devices.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let busy = false;
    const reconnect = async () => {
      const prefs = readPrefs();
      if (busy || !prefs.enabled || notificationSupport() !== 'granted' || !pushAvailable()) return;
      busy = true;
      let push = false;
      try { await savePushSubscription(userId, prefs); push = true; } catch { /* retain local fallback */ }
      if (!cancelled && readPrefs().enabled) writePrefs({ ...readPrefs(), push });
      busy = false;
    };
    void reconnect();
    const resume = () => { if (!document.hidden) void reconnect(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { cancelled = true; window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [userId]);
  const { semester } = useSemester();
  const { data: courses = [] } = useCourses(semester?.id);
  const { data: tasks = [] } = useTasks();
  const data = useRef({ courses, tasks });
  data.current = { courses, tasks };

  useEffect(() => {
    const tick = () => {
      const prefs = readPrefs();
      if (!prefs.enabled || prefs.push || notificationSupport() !== 'granted') return; // push: the server sends them
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
