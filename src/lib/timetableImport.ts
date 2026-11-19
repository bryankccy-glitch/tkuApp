import { courseKey, isTa, mostFrequent, normalizeImportCells } from './ocr/normalizeCells';
import { TKU_PERIODS } from './periods';
import { COURSE_COLORS, type CourseColor, type Weekday } from './types';

/**
 * One filled cell of a 淡江 timetable grid, as read from a screenshot by the vision model.
 * Kept deliberately flat (one entry per cell) — merging is done here, deterministically.
 */
export interface ImportCell {
  weekday: number; // 1 = 週一 … 7 = 週日
  period: number; // 節次 1–14
  group: string; // 開課班級，例如「資管二」「共同科」
  course: string;
  teacher: string; // 「助　教」= teaching-assistant session
  room: string; // e.g. "B 217"
}

export interface DraftSlot {
  weekday: Weekday;
  fromPeriod: number;
  toPeriod: number;
  startTime: string;
  endTime: string;
  room: string;
}

export interface DraftCourse {
  key: string;
  name: string;
  instructor: string;
  group: string;
  slots: DraftSlot[];
}

export interface ImportResult {
  courses: DraftCourse[];
  /** Cells we could not place (e.g. night periods whose times aren't verified). */
  skipped: ImportCell[];
}

/** "B 217" / "ｂ２１７" → "B217"; keeps building letters + number, uppercase. */
export function normalizeRoom(room: string): string {
  return room.normalize('NFKC').replace(/\s+/g, '').toUpperCase().slice(0, 20);
}

/** Collapse whitespace (incl. full-width spaces) but keep the original characters for display. */
function cleanText(s: string, max: number) {
  return s.replace(/[\s\u3000]+/g, ' ').trim().slice(0, max);
}

/** Merge OCR variants of the same course; TA sessions stay separate. */
export function cellsToCourses(cells: ImportCell[]): ImportResult {
  const skipped: ImportCell[] = [];
  const valid: (ImportCell & { roomN: string })[] = [];
  const seen = new Set<string>();
  for (const c of cells) {
    const name = cleanText(c.course, 80);
    const period = TKU_PERIODS.find((p) => p.no === c.period);
    if (!name || !Number.isInteger(c.weekday) || c.weekday < 1 || c.weekday > 7) continue;
    if (!period) { skipped.push(c); continue; }
    const dup = `${c.weekday}-${c.period}-${courseKey(name)}-${isTa(c.teacher)}`;
    if (seen.has(dup)) continue; // the model sometimes repeats a cell
    seen.add(dup);
    valid.push({ ...c, course: name, group: cleanText(c.group, 40), teacher: cleanText(c.teacher, 60), roomN: normalizeRoom(c.room) });
  }

  const byCourse = new Map<string, typeof valid>();
  for (const c of normalizeImportCells(valid)) {
    const teacher = isTa(c.teacher) ? '助教' : c.teacher;
    const k = `${courseKey(c.course)}::${isTa(teacher) ? 'ta' : 'lecture'}`;
    byCourse.set(k, [...(byCourse.get(k) ?? []), { ...c, roomN: normalizeRoom(c.room) }]);
  }

  const courses: DraftCourse[] = [];
  for (const [key, list] of byCourse) {
    const originalOrder = new Map(list.map((c, i) => [c, i]));
    list.sort((a, b) => a.weekday - b.weekday || a.period - b.period);
    const segments: (typeof list)[] = [];
    for (const c of list) {
      const segment = segments[segments.length - 1];
      const last = segment?.[segment.length - 1];
      if (last && last.weekday === c.weekday && last.period === c.period) continue;
      if (last && last.weekday === c.weekday && last.period === c.period - 1) segment!.push(c);
      else segments.push([c]);
    }
    const slots: DraftSlot[] = segments.map((segment) => {
      const first = segment[0]!, last = segment[segment.length - 1]!;
      const roomReadings = [...segment].sort((a, b) => originalOrder.get(a)! - originalOrder.get(b)!);
      return {
        weekday: first.weekday as Weekday, fromPeriod: first.period, toPeriod: last.period,
        startTime: TKU_PERIODS.find((p) => p.no === first.period)!.start,
        endTime: TKU_PERIODS.find((p) => p.no === last.period)!.end,
        room: mostFrequent(roomReadings.map((c) => c.roomN)),
      };
    });
    const ta = isTa(list[0]!.teacher);
    const instructor = ta ? '助教' : list[0]!.teacher;
    const group = list.find((c) => c.group)?.group ?? '';
    // The name suffix keeps TA entries distinguishable in existing repositories,
    // exports and friends' read-only schedules without a database migration.
    const name = ta ? `${list[0]!.course}（助教）`.slice(0, 80) : list[0]!.course;
    courses.push({ key, name, instructor, group, slots });
  }
  courses.sort((a, b) => a.slots[0]!.weekday - b.slots[0]!.weekday || a.slots[0]!.fromPeriod - b.slots[0]!.fromPeriod);
  return { courses, skipped };
}

/** Course colours cycle in a stable order so neighbouring courses look different. */
export function colorFor(index: number): CourseColor {
  return COURSE_COLORS[index % COURSE_COLORS.length]!;
}
