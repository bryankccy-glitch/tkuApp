import type { CalendarEvent, Course, Semester, Task } from './types';
import { taipeiDate, taipeiMinutes } from './taipei';
import { courseTitle } from './courseTitle';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const taipeiDayKey = (date: Date) => {
  const { y, m, d } = taipeiDate(date);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
export function dateKey(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}
export function monthDates(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => dateKey(year, month, 1 - mondayOffset + i));
}
export const calendarTime = (iso: string) => {
  const minutes = taipeiMinutes(new Date(iso));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
export interface CalendarItem {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  location: string;
  source: 'course' | 'task' | 'personal';
  href?: string;
  event?: CalendarEvent;
}

/** Expands weekly events only for the requested day; no device timezone assumptions. */
export function calendarItemsOn(day: string, courses: Course[], tasks: Task[], events: CalendarEvent[], semester?: Semester): CalendarItem[] {
  const items: CalendarItem[] = [];
  const dayStart = new Date(`${day}T00:00:00+08:00`).getTime();
  const dayEnd = dayStart + DAY;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
  if (semester && day >= semester.startDate && day <= semester.endDate) {
    for (const course of courses) for (const slot of course.slots) if (slot.weekday === weekday) {
      items.push({ id: `course:${slot.id}`, title: courseTitle(course), time: slot.startTime, endTime: slot.endTime,
        location: slot.room, source: 'course', href: `/schedule/course/${course.id}` });
    }
  }
  for (const task of tasks) if (taipeiDayKey(new Date(task.dueAt)) === day) {
    items.push({ id: `task:${task.id}`, title: `${task.completed ? '✓ ' : ''}${task.title}`,
      time: calendarTime(task.dueAt), location: '', source: 'task', href: '/tasks' });
  }
  for (const event of events) {
    const originalStart = new Date(event.startsAt).getTime();
    const duration = new Date(event.endsAt).getTime() - originalStart;
    const repeatIndex = event.repeat === 'weekly' ? Math.floor((dayEnd - 1 - originalStart) / WEEK) : 0;
    if (repeatIndex < 0) continue;
    const start = originalStart + repeatIndex * WEEK;
    const end = start + duration;
    if (start >= dayEnd || end <= dayStart) continue;
    const occurrenceDay = taipeiDayKey(new Date(start));
    if (event.repeat === 'weekly' && event.repeatUntil && occurrenceDay > event.repeatUntil) continue;
    items.push({ id: `event:${event.id}:${start}`, title: event.title, time: calendarTime(new Date(Math.max(dayStart, start)).toISOString()),
      endTime: end >= dayEnd ? '24:00' : calendarTime(new Date(end).toISOString()), location: event.location, source: 'personal', event });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}
