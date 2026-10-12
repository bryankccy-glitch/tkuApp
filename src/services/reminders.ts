import type { Course, Task } from '@/lib/types';
import { occurrencesOn } from '@/lib/schedule';
import { addDays, weekdayOf } from '@/lib/time';
import { TASK_KIND_LABELS } from '@/lib/labels';
import { buildingFromRoom } from '@/data/places';
import i18n from '@/i18n';

/**
 * 本機提醒：App 開著（或在背景仍執行）時，以系統通知提醒上課與截止。
 * App 完全關閉後的推播需要伺服器端 Web Push（見 ROADMAP）。
 */
export interface ReminderPrefs {
  enabled: boolean;
  /** minutes before class; 0 = off */
  classMinutes: number;
  /** use each task's own remindMinutesBefore */
  tasks: boolean;
}

export const DEFAULT_PREFS: ReminderPrefs = { enabled: false, classMinutes: 10, tasks: true };
const PREFS_KEY = 'tku.reminders.v1';
const FIRED_KEY = 'tku.reminders.fired.v1';

export interface Reminder {
  id: string;
  at: number; // epoch ms when to notify
  title: string;
  body: string;
  url: string;
}

export function readPrefs(): ReminderPrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ReminderPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: ReminderPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Reminders that should fire between `from` and `to` (epoch ms). Pure — easy to test. */
export function remindersBetween(courses: Course[], tasks: Task[], prefs: ReminderPrefs, from: number, to: number): Reminder[] {
  if (!prefs.enabled) return [];
  const out: Reminder[] = [];
  if (prefs.classMinutes > 0) {
    for (let d = 0; d <= 1; d++) {
      const day = addDays(new Date(from), d);
      for (const { course, slot } of occurrencesOn(courses, weekdayOf(day))) {
        const [h, m] = slot.startTime.split(':').map(Number);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0).getTime();
        const at = start - prefs.classMinutes * 60_000;
        if (at >= from && at < to) {
          const b = buildingFromRoom(slot.room);
          out.push({
            id: `class:${slot.id}:${start}`,
            at,
            title: i18n.t('reminder.classTitle', { minutes: prefs.classMinutes, course: course.name }),
            body: [slot.room && `${slot.room}${b ? `（${b.name}）` : ''}`, `${slot.startTime}–${slot.endTime}`, course.instructor].filter(Boolean).join('　'),
            url: `/schedule/course/${course.id}`,
          });
        }
      }
    }
  }
  if (prefs.tasks) {
    for (const t of tasks) {
      if (t.completed || t.remindMinutesBefore === null) continue;
      const due = new Date(t.dueAt).getTime();
      const at = due - t.remindMinutesBefore * 60_000;
      if (at >= from && at < to) {
        out.push({
          id: `task:${t.id}:${due}:${t.remindMinutesBefore}`,
          at,
          title: i18n.t('reminder.taskTitle', { kind: TASK_KIND_LABELS[t.kind], title: t.title }),
          body: i18n.t('reminder.taskBody', { time: new Date(due).toLocaleString(i18n.language === 'en' ? 'en-US' : 'zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }) }),
          url: '/tasks',
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function markFired(id: string, now: number) {
  const fired = readFired();
  fired[id] = now;
  // keep two days of history
  for (const [k, v] of Object.entries(fired)) if (now - v > 2 * 86400_000) delete fired[k];
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* ignore */
  }
}

export type NotifySupport = 'unsupported' | 'default' | 'granted' | 'denied';
export function notificationSupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifySupport;
}

/** Shows a notification via the service worker when possible (required on Android), else the page API. */
export async function showReminder(r: Reminder) {
  const opts: NotificationOptions = { body: r.body, icon: '/icons/icon-192.png', badge: '/icons/favicon-48.png', tag: r.id, data: { url: r.url } };
  try {
    const reg = 'serviceWorker' in navigator ? await Promise.race([navigator.serviceWorker.ready, new Promise<null>((res) => setTimeout(() => res(null), 1500))]) : null;
    if (reg) return await reg.showNotification(r.title, opts);
  } catch {
    /* fall through */
  }
  const n = new Notification(r.title, opts);
  n.onclick = () => {
    window.focus();
    window.location.assign(r.url);
  };
}
