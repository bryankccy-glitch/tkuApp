import { TKU_PERIODS } from '../periods';
import type { Course, Weekday } from '../types';

export interface FreeBlock {
  weekday: Weekday;
  /** First and last TKU period number of the block (inclusive). */
  from: number;
  to: number;
  startTime: string;
  endTime: string;
}

/** True when any slot of these courses overlaps [start, end) on that day. */
function busy(courses: Course[], weekday: Weekday, start: string, end: string) {
  return courses.some((c) => c.slots.some((s) => s.weekday === weekday && s.startTime < end && start < s.endTime));
}

/**
 * Periods (1–12, Mon–Fri by default) when everyone in `people` is free, merged into
 * contiguous blocks. Used for 「共同空堂」 between you and a friend.
 */
export function commonFreeBlocks(people: Course[][], days: Weekday[] = [1, 2, 3, 4, 5]): FreeBlock[] {
  const out: FreeBlock[] = [];
  for (const d of days) {
    let current: FreeBlock | null = null;
    for (const p of TKU_PERIODS) {
      const free = people.every((courses) => !busy(courses, d, p.start, p.end));
      if (free) {
        if (current && current.to === p.no - 1) {
          current.to = p.no;
          current.endTime = p.end;
        } else {
          current = { weekday: d, from: p.no, to: p.no, startTime: p.start, endTime: p.end };
          out.push(current);
        }
      } else {
        current = null;
      }
    }
  }
  return out;
}
