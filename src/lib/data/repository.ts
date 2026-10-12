import type { Course, Profile, Semester, Task } from '../types';

export type CourseInput = Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'slots'> & {
  id?: string;
  slots: Omit<Course['slots'][number], 'id'>[] | Course['slots'];
};
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type SemesterInput = Omit<Semester, 'id'> & { id?: string };

export interface ExportBundle {
  exportedAt: string;
  app: 'tku-campus-os';
  version: 1;
  profile: Profile | null;
  semesters: Semester[];
  courses: Course[];
  tasks: Task[];
}

/** Storage-agnostic data access. Implemented by LocalRepository and SupabaseRepository. */
export interface DataRepository {
  readonly mode: 'local' | 'cloud';
  getProfile(): Promise<Profile | null>;
  updateProfile(p: Partial<Omit<Profile, 'id'>>): Promise<Profile>;

  listSemesters(): Promise<Semester[]>;
  upsertSemester(s: SemesterInput): Promise<Semester>;

  listCourses(semesterId: string): Promise<Course[]>;
  upsertCourse(c: CourseInput): Promise<Course>;
  deleteCourse(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  upsertTask(t: TaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  /** Removes every personal record owned by the current user. */
  deleteAllData(): Promise<void>;
}
