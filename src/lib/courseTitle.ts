import type { Course } from './types';

/** The displayed teacher comes from the saved course, never inferred. */
export function courseTitle(course: Pick<Course, 'name' | 'instructor'>): string {
  const teacher = course.instructor?.trim();
  if (!teacher || course.name.endsWith(`（${teacher}）`) || course.name.endsWith(`(${teacher})`)) return course.name;
  return `${course.name}（${teacher}）`;
}
