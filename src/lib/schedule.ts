import type { Course, ScheduleSlot, Weekday } from './types';
import { toMinutes, weekdayOf, nowHHMM } from './time';

export interface Occurrence {
  course: Course;
  slot: ScheduleSlot;
}

export interface Conflict {
  a: Occurrence;
  b: Occurrence;
}

function overlaps(x: ScheduleSlot, y: ScheduleSlot): boolean {
  return x.weekday === y.weekday && toMinutes(x.startTime) < toMinutes(y.endTime) && toMinutes(y.startTime) < toMinutes(x.endTime);
}

/** All pairs of overlapping slots across courses (and within a course). */
export function findConflicts(courses: Course[]): Conflict[] {
  const occ: Occurrence[] = courses.flatMap((course) => course.slots.map((slot) => ({ course, slot })));
  const out: Conflict[] = [];
  for (let i = 0; i < occ.length; i++) {
    for (let j = i + 1; j < occ.length; j++) {
      const a = occ[i]!;
      const b = occ[j]!;
      if (overlaps(a.slot, b.slot)) out.push({ a, b });
    }
  }
  return out;
}

/** Conflicts a candidate course (new or edited) would cause against the existing list. */
export function conflictsFor(candidate: Pick<Course, 'id' | 'slots'>, courses: Course[]): Occurrence[] {
  const others = courses.filter((c) => c.id !== candidate.id);
  const hits: Occurrence[] = [];
  for (const slot of candidate.slots) {
    for (const course of others) {
      for (const s of course.slots) if (overlaps(slot, s)) hits.push({ course, slot: s });
    }
  }
  return hits;
}

export function validateSlot(slot: Pick<ScheduleSlot, 'startTime' | 'endTime'>): string | null {
  if (!/^\d{2}:\d{2}$/.test(slot.startTime) || !/^\d{2}:\d{2}$/.test(slot.endTime)) return '時間格式需為 HH:mm';
  if (toMinutes(slot.endTime) <= toMinutes(slot.startTime)) return '下課時間必須晚於上課時間';
  return null;
}

export function occurrencesOn(courses: Course[], weekday: Weekday): Occurrence[] {
  return courses
    .flatMap((course) => course.slots.filter((s) => s.weekday === weekday).map((slot) => ({ course, slot })))
    .sort((x, y) => toMinutes(x.slot.startTime) - toMinutes(y.slot.startTime));
}

export type ClassStatus = 'done' | 'ongoing' | 'upcoming';
export function statusAt(slot: ScheduleSlot, now: Date): ClassStatus {
  const t = toMinutes(nowHHMM(now));
  if (t >= toMinutes(slot.endTime)) return 'done';
  if (t >= toMinutes(slot.startTime)) return 'ongoing';
  return 'upcoming';
}

export interface NextClass extends Occurrence {
  startsAt: Date;
  endsAt: Date;
  ongoing: boolean;
}

/** The ongoing or next class within the coming 7 days. */
export function findNextClass(courses: Course[], now: Date): NextClass | null {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const list = occurrencesOn(courses, weekdayOf(day));
    for (const o of list) {
      const [sh, sm] = o.slot.startTime.split(':').map(Number);
      const [eh, em] = o.slot.endTime.split(':').map(Number);
      const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh ?? 0, sm ?? 0);
      const endsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh ?? 0, em ?? 0);
      if (endsAt > now) return { ...o, startsAt, endsAt, ongoing: startsAt <= now };
    }
  }
  return null;
}
