export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = 週一 … 7 = 週日

export const COURSE_COLORS = ['navy', 'blue', 'heritage', 'teal', 'amber', 'violet', 'slate'] as const;
export type CourseColor = (typeof COURSE_COLORS)[number];

export interface Semester {
  id: string;
  /** e.g. "115-1" (民國學年-學期) */
  code: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ScheduleSlot {
  id: string;
  weekday: Weekday;
  /** HH:mm */
  startTime: string;
  endTime: string;
  /** e.g. "E304" */
  room: string;
}

export interface Course {
  id: string;
  semesterId: string;
  name: string;
  code?: string;
  instructor?: string;
  color: CourseColor;
  notes?: string;
  slots: ScheduleSlot[];
  createdAt: string;
  updatedAt: string;
}

export const TASK_KINDS = ['homework', 'report', 'quiz', 'midterm', 'final', 'personal'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description?: string;
  kind: TaskKind;
  courseId?: string | null;
  /** ISO datetime of due moment (local time encoded with offset) */
  dueAt: string;
  priority: TaskPriority;
  completed: boolean;
  completedAt?: string | null;
  /** minutes before due; null = no reminder */
  remindMinutesBefore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  displayName: string;
  department?: string;
  grade?: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  category: EventCategory;
  summary: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string;
  organizer: string;
  sourceName: string;
  sourceUrl: string;
  registrationUrl?: string | null;
  publishedAt: string;
}

export const EVENT_CATEGORIES = [
  'campus',
  'club',
  'lecture',
  'hackathon',
  'programming',
  'internship',
  'scholarship',
  'research',
  'industry',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
