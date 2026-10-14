import { uid } from '../id';
import i18n from '@/i18n';
import type { CalendarEvent, Course, Profile, Semester, Task } from '../types';
import type { CalendarEventInput, CourseInput, DataRepository, ExportBundle, SemesterInput, TaskInput } from './repository';
import type { SocialApi } from '../social/types';
import { inferSemester } from './semesters';

/**
 * 本機模式：資料只存在此瀏覽器的 localStorage。
 * 適合未設定 Supabase 時試用；不會上傳任何資料。
 */
const KEY = 'tku.local.v1';

interface Store {
  profile: Profile | null;
  semesters: Semester[];
  courses: Course[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
}

function emptyStore(): Store {
  return { profile: null, semesters: [], courses: [], tasks: [], calendarEvents: [] };
}

export class LocalRepository implements DataRepository {
  readonly mode = 'local' as const;
  /** No accounts on-device; tests may inject a fake. */
  readonly social: SocialApi | null = null;
  private memory: Store | null = null;

  constructor(private storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {}

  private read(): Store {
    if (this.memory) return this.memory;
    try {
      const raw = this.storage?.getItem(KEY);
      this.memory = raw ? { ...emptyStore(), ...(JSON.parse(raw) as Store) } : emptyStore();
    } catch {
      this.memory = emptyStore();
    }
    return this.memory;
  }

  private write(s: Store) {
    this.memory = s;
    try {
      this.storage?.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage full or blocked: keep in memory */
    }
  }

  async getProfile() {
    return this.read().profile;
  }

  async updateProfile(p: Partial<Omit<Profile, 'id'>>) {
    const s = this.read();
    const profile: Profile = { id: 'local', displayName: i18n.t('defaults.studentName'), ...s.profile, ...p };
    this.write({ ...s, profile });
    return profile;
  }

  async listSemesters() {
    const s = this.read();
    if (s.semesters.length === 0) {
      const sem = { id: uid(), ...inferSemester(new Date()) };
      this.write({ ...s, semesters: [sem] });
      return [sem];
    }
    return [...s.semesters].sort((a, b) => b.code.localeCompare(a.code));
  }

  async upsertSemester(input: SemesterInput) {
    const s = this.read();
    const sem: Semester = { ...input, id: input.id ?? uid() };
    const semesters = s.semesters.some((x) => x.id === sem.id)
      ? s.semesters.map((x) => (x.id === sem.id ? sem : x))
      : [...s.semesters, sem];
    this.write({ ...s, semesters });
    return sem;
  }

  async listCourses(semesterId: string) {
    return this.read().courses.filter((c) => c.semesterId === semesterId);
  }

  async upsertCourse(input: CourseInput) {
    const s = this.read();
    const now = new Date().toISOString();
    const prev = input.id ? s.courses.find((c) => c.id === input.id) : undefined;
    const course: Course = {
      ...input,
      id: prev?.id ?? input.id ?? uid(),
      slots: input.slots.map((sl) => ({ ...sl, id: 'id' in sl && sl.id ? sl.id : uid() })),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    const courses = prev ? s.courses.map((c) => (c.id === course.id ? course : c)) : [...s.courses, course];
    this.write({ ...s, courses });
    return course;
  }

  async deleteCourse(id: string) {
    const s = this.read();
    this.write({
      ...s,
      courses: s.courses.filter((c) => c.id !== id),
      tasks: s.tasks.map((t) => (t.courseId === id ? { ...t, courseId: null } : t)),
    });
  }

  async listTasks() {
    return this.read().tasks;
  }

  async upsertTask(input: TaskInput) {
    const s = this.read();
    const now = new Date().toISOString();
    const prev = input.id ? s.tasks.find((t) => t.id === input.id) : undefined;
    const task: Task = {
      ...input,
      id: prev?.id ?? input.id ?? uid(),
      completedAt: input.completed ? (prev?.completedAt ?? now) : null,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    const tasks = prev ? s.tasks.map((t) => (t.id === task.id ? task : t)) : [...s.tasks, task];
    this.write({ ...s, tasks });
    return task;
  }

  async deleteTask(id: string) {
    const s = this.read();
    this.write({ ...s, tasks: s.tasks.filter((t) => t.id !== id) });
  }

  async listCalendarEvents() { return [...this.read().calendarEvents]; }

  async upsertCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const store = this.read();
    const previous = store.calendarEvents.find((event) => event.id === input.id);
    const now = new Date().toISOString();
    const event: CalendarEvent = { ...input, id: previous?.id ?? input.id ?? uid(), createdAt: previous?.createdAt ?? now, updatedAt: now };
    this.write({ ...store, calendarEvents: previous ? store.calendarEvents.map((item) => item.id === event.id ? event : item) : [...store.calendarEvents, event] });
    return event;
  }

  async deleteCalendarEvent(id: string) {
    const store = this.read();
    this.write({ ...store, calendarEvents: store.calendarEvents.filter((event) => event.id !== id) });
  }

  async exportAll(): Promise<ExportBundle> {
    const s = this.read();
    return { exportedAt: new Date().toISOString(), app: 'tku-campus-os', version: 1, ...s };
  }

  async deleteAllData() {
    this.write(emptyStore());
  }
}
