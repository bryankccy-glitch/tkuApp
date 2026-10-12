import type { CourseColor, EventCategory, TaskKind, TaskPriority, Weekday } from './types';

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日',
};
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  homework: '作業', report: '報告', quiz: '小考', midterm: '期中考', final: '期末考', personal: '個人任務',
};
export const EXAM_KINDS: TaskKind[] = ['quiz', 'midterm', 'final'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = { low: '低', medium: '中', high: '高' };

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  campus: '校園活動', club: '社團活動', lecture: '學術講座', hackathon: '黑客松', programming: '程式競賽',
  internship: '實習', scholarship: '獎學金', research: '研究計畫', industry: '企業合作',
};

/** Tailwind-safe class sets for course colors (bg tint, solid bar, text). */
export const COURSE_COLOR_STYLES: Record<CourseColor, { bar: string; tint: string; text: string; label: string }> = {
  navy: { bar: 'bg-[#15345A] dark:bg-[#7FA6D6]', tint: 'bg-[#15345A]/10 dark:bg-[#7FA6D6]/15', text: 'text-[#15345A] dark:text-[#AFC8EA]', label: '淡江藍' },
  blue: { bar: 'bg-[#3478C8]', tint: 'bg-[#3478C8]/12 dark:bg-[#3478C8]/20', text: 'text-[#245C9E] dark:text-[#9CC4F0]', label: '校園藍' },
  heritage: { bar: 'bg-[#B3262D] dark:bg-[#E8545A]', tint: 'bg-[#B3262D]/10 dark:bg-[#E8545A]/15', text: 'text-[#961C24] dark:text-[#F4A0A3]', label: '淡江紅' },
  teal: { bar: 'bg-[#1F7A72]', tint: 'bg-[#1F7A72]/10 dark:bg-[#1F7A72]/25', text: 'text-[#17625B] dark:text-[#86D1C8]', label: '淡水綠' },
  amber: { bar: 'bg-[#B9781B]', tint: 'bg-[#B9781B]/12 dark:bg-[#B9781B]/25', text: 'text-[#8A5710] dark:text-[#F0C77F]', label: '夕照橘' },
  violet: { bar: 'bg-[#6B4FA0]', tint: 'bg-[#6B4FA0]/10 dark:bg-[#6B4FA0]/25', text: 'text-[#56408A] dark:text-[#C3B0EA]', label: '暮色紫' },
  slate: { bar: 'bg-[#5C697C]', tint: 'bg-[#5C697C]/10 dark:bg-[#5C697C]/25', text: 'text-[#46505F] dark:text-[#C2CBD8]', label: '石板灰' },
};
