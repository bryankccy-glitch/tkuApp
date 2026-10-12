import type { PlaceCategory } from '@/data/places';
import i18n from '@/i18n';
import type { CourseColor, EventCategory, TaskKind, TaskPriority, Weekday } from './types';

/** A read-only map whose values are looked up in the active language at access time. */
function translated<K extends string | number>(ns: string): Record<K, string> {
  return new Proxy({} as Record<K, string>, { get: (_t, k) => (typeof k === 'string' ? i18n.t(`${ns}.${k}`) : undefined) });
}

export const WEEKDAY_LABELS = translated<Weekday>('weekday');
export const WEEKDAY_SHORT = translated<Weekday>('weekdayShort');

export const TASK_KIND_LABELS = translated<TaskKind>('taskKind');
export const EXAM_KINDS: TaskKind[] = ['quiz', 'midterm', 'final'];

export const PRIORITY_LABELS = translated<TaskPriority>('priority');

export const EVENT_CATEGORY_LABELS = translated<EventCategory>('eventCategory');

export const PLACE_CATEGORY_LABELS = translated<PlaceCategory>('placeCategory');

/** Tailwind-safe class sets for course colors (bg tint, solid bar, text). */
export const COURSE_COLOR_STYLES: Record<CourseColor, { bar: string; tint: string; text: string; label: string }> = {
  navy: { bar: 'bg-[#15345A] dark:bg-[#7FA6D6]', tint: 'bg-[#15345A]/10 dark:bg-[#7FA6D6]/15', text: 'text-[#15345A] dark:text-[#AFC8EA]', get label() { return i18n.t('courseColor.navy'); } },
  blue: { bar: 'bg-[#3478C8]', tint: 'bg-[#3478C8]/12 dark:bg-[#3478C8]/20', text: 'text-[#245C9E] dark:text-[#9CC4F0]', get label() { return i18n.t('courseColor.blue'); } },
  heritage: { bar: 'bg-[#B3262D] dark:bg-[#E8545A]', tint: 'bg-[#B3262D]/10 dark:bg-[#E8545A]/15', text: 'text-[#961C24] dark:text-[#F4A0A3]', get label() { return i18n.t('courseColor.heritage'); } },
  teal: { bar: 'bg-[#1F7A72]', tint: 'bg-[#1F7A72]/10 dark:bg-[#1F7A72]/25', text: 'text-[#17625B] dark:text-[#86D1C8]', get label() { return i18n.t('courseColor.teal'); } },
  amber: { bar: 'bg-[#B9781B]', tint: 'bg-[#B9781B]/12 dark:bg-[#B9781B]/25', text: 'text-[#8A5710] dark:text-[#F0C77F]', get label() { return i18n.t('courseColor.amber'); } },
  violet: { bar: 'bg-[#6B4FA0]', tint: 'bg-[#6B4FA0]/10 dark:bg-[#6B4FA0]/25', text: 'text-[#56408A] dark:text-[#C3B0EA]', get label() { return i18n.t('courseColor.violet'); } },
  slate: { bar: 'bg-[#5C697C]', tint: 'bg-[#5C697C]/10 dark:bg-[#5C697C]/25', text: 'text-[#46505F] dark:text-[#C2CBD8]', get label() { return i18n.t('courseColor.slate'); } },
};
