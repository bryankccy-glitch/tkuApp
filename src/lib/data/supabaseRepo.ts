import type { SupabaseClient } from '@supabase/supabase-js';
import i18n from '@/i18n';
import type { CalendarEvent, Course, CourseColor, Profile, Semester, Task, TaskKind, TaskPriority, Weekday } from '../types';
import type { CalendarEventInput, CourseInput, DataRepository, ExportBundle, SemesterInput, TaskInput } from './repository';
import { inferSemester } from './semesters';
import { SupabaseSocial } from '../social/supabaseSocial';

interface CourseRow {
  id: string; semester_id: string; name: string; code: string | null; instructor: string | null;
  color: CourseColor; notes: string | null; created_at: string; updated_at: string;
  schedule_entries: { id: string; weekday: number; start_time: string; end_time: string; room: string }[];
}
interface TaskRow {
  id: string; title: string; description: string | null; kind: TaskKind; user_course_id: string | null;
  due_at: string; priority: TaskPriority; completed: boolean; completed_at: string | null;
  remind_minutes_before: number | null; created_at: string; updated_at: string;
}

const hhmm = (t: string) => t.slice(0, 5);
interface CalendarRow {
  id: string; title: string; kind: CalendarEvent['kind']; starts_at: string; ends_at: string;
  location: string; notes: string; repeat: CalendarEvent['repeat']; repeat_until: string | null;
  created_at: string; updated_at: string;
}
function mapCalendarEvent(row: CalendarRow): CalendarEvent {
  return { id: row.id, title: row.title, kind: row.kind, startsAt: row.starts_at, endsAt: row.ends_at,
    location: row.location, notes: row.notes, repeat: row.repeat, repeatUntil: row.repeat_until ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapCourse(r: CourseRow): Course {
  return {
    id: r.id, semesterId: r.semester_id, name: r.name, code: r.code ?? undefined, instructor: r.instructor ?? undefined,
    color: r.color, notes: r.notes ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
    slots: r.schedule_entries.map((s) => ({ id: s.id, weekday: s.weekday as Weekday, startTime: hhmm(s.start_time), endTime: hhmm(s.end_time), room: s.room })),
  };
}
function mapTask(r: TaskRow): Task {
  return {
    id: r.id, title: r.title, description: r.description ?? undefined, kind: r.kind, courseId: r.user_course_id,
    dueAt: r.due_at, priority: r.priority, completed: r.completed, completedAt: r.completed_at,
    remindMinutesBefore: r.remind_minutes_before, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

type Res<T> = { data: T | null; error: { message: string } | null };
interface ProfileRow { id: string; display_name: string; department: string | null; grade: string | null }
interface SemesterRow { id: string; code: string; name: string; start_date: string; end_date: string }
/** Throws on error or missing data. */
function check<T>(res: Res<T>): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error(i18n.t('errors.notFound'));
  return res.data as NonNullable<T>;
}
function checkMaybe<T>(res: Res<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
function ok(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Cloud mode. Every query runs with the user's JWT, so RLS enforces ownership server-side. */
export class SupabaseRepository implements DataRepository {
  readonly mode = 'cloud' as const;
  readonly social: SupabaseSocial;
  constructor(private db: SupabaseClient, private userId: string) {
    this.social = new SupabaseSocial(db, userId);
  }

  async getProfile(): Promise<Profile | null> {
    const row = checkMaybe<ProfileRow>(await this.db.from('profiles').select('id, display_name, department, grade').eq('id', this.userId).maybeSingle());
    return row ? { id: row.id, displayName: row.display_name, department: row.department ?? undefined, grade: row.grade ?? undefined } : null;
  }

  async updateProfile(p: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
    const row = check<ProfileRow>(
      await this.db.from('profiles')
        .update({ display_name: p.displayName, department: p.department ?? null, grade: p.grade ?? null })
        .eq('id', this.userId).select('id, display_name, department, grade').single(),
    );
    return { id: row.id, displayName: row.display_name, department: row.department ?? undefined, grade: row.grade ?? undefined };
  }

  async listSemesters(): Promise<Semester[]> {
    let rows: SemesterRow[] = check<SemesterRow[]>(await this.db.from('semesters').select('id, code, name, start_date, end_date').order('code', { ascending: false }));
    if (!rows || rows.length === 0) {
      const s = inferSemester(new Date());
      await this.upsertSemester(s);
      rows = check<SemesterRow[]>(await this.db.from('semesters').select('id, code, name, start_date, end_date').order('code', { ascending: false }));
    }
    return (rows ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, startDate: r.start_date, endDate: r.end_date }));
  }

  async upsertSemester(s: SemesterInput): Promise<Semester> {
    const row = check<SemesterRow>(
      await this.db.from('semesters')
        .upsert({ id: s.id, user_id: this.userId, code: s.code, name: s.name, start_date: s.startDate, end_date: s.endDate })
        .select('id, code, name, start_date, end_date').single(),
    );
    return { id: row.id, code: row.code, name: row.name, startDate: row.start_date, endDate: row.end_date };
  }

  async listCourses(semesterId: string): Promise<Course[]> {
    const rows = check(
      await this.db.from('user_courses')
        .select('id, semester_id, name, code, instructor, color, notes, created_at, updated_at, schedule_entries(id, weekday, start_time, end_time, room)')
        .eq('semester_id', semesterId),
    ) as unknown as CourseRow[];
    return rows.map(mapCourse);
  }

  async upsertCourse(c: CourseInput): Promise<Course> {
    const row = check<{ id: string }>(
      await this.db.from('user_courses')
        .upsert({ id: c.id, user_id: this.userId, semester_id: c.semesterId, name: c.name, code: c.code ?? null, instructor: c.instructor ?? null, color: c.color, notes: c.notes ?? null })
        .select('id').single(),
    );
    // Insert the new slots before removing the old ones: if this fails, the timetable stays intact.
    const existing = check(
      await this.db.from('schedule_entries').select('id').eq('user_course_id', row.id),
    ) as unknown as { id: string }[];
    if (c.slots.length) {
      ok(
        await this.db.from('schedule_entries').insert(
          c.slots.map((s) => ({ user_id: this.userId, user_course_id: row.id, weekday: s.weekday, start_time: s.startTime, end_time: s.endTime, room: s.room })),
        ),
      );
    }
    if (existing.length) {
      ok(await this.db.from('schedule_entries').delete().in('id', existing.map((e) => e.id)));
    }
    const full = check(
      await this.db.from('user_courses')
        .select('id, semester_id, name, code, instructor, color, notes, created_at, updated_at, schedule_entries(id, weekday, start_time, end_time, room)')
        .eq('id', row.id).single(),
    ) as unknown as CourseRow;
    return mapCourse(full);
  }

  async deleteCourse(id: string) {
    ok(await this.db.from('user_courses').delete().eq('id', id));
  }

  async listTasks(): Promise<Task[]> {
    const rows = check(await this.db.from('tasks').select('*').order('due_at')) as TaskRow[];
    return rows.map(mapTask);
  }

  async upsertTask(t: TaskInput): Promise<Task> {
    const row = check(
      await this.db.from('tasks')
        .upsert({
          id: t.id, user_id: this.userId, title: t.title, description: t.description ?? null, kind: t.kind,
          user_course_id: t.courseId ?? null, due_at: t.dueAt, priority: t.priority, completed: t.completed,
          completed_at: t.completed ? (t.completedAt ?? new Date().toISOString()) : null, remind_minutes_before: t.remindMinutesBefore,
        })
        .select('*').single(),
    ) as TaskRow;
    return mapTask(row);
  }

  async deleteTask(id: string) {
    ok(await this.db.from('tasks').delete().eq('id', id));
  }

  async listCalendarEvents(): Promise<CalendarEvent[]> {
    const rows = check<CalendarRow[]>(await this.db.from('calendar_events').select('*').eq('user_id', this.userId).order('starts_at'));
    return rows.map(mapCalendarEvent);
  }

  async upsertCalendarEvent(event: CalendarEventInput): Promise<CalendarEvent> {
    const row = check<CalendarRow>(await this.db.from('calendar_events').upsert({
      id: event.id, user_id: this.userId, title: event.title, kind: event.kind, starts_at: event.startsAt, ends_at: event.endsAt,
      location: event.location, notes: event.notes, repeat: event.repeat, repeat_until: event.repeatUntil ?? null,
    }).select('*').single());
    return mapCalendarEvent(row);
  }

  async deleteCalendarEvent(id: string) {
    ok(await this.db.from('calendar_events').delete().eq('id', id).eq('user_id', this.userId));
  }

  async exportAll(): Promise<ExportBundle> {
    const [profile, semesters, tasks] = await Promise.all([this.getProfile(), this.listSemesters(), this.listTasks()]);
    const courses = (await Promise.all(semesters.map((s) => this.listCourses(s.id)))).flat();
    const calendarEvents = await this.listCalendarEvents();
    return { exportedAt: new Date().toISOString(), app: 'tku-campus-os', version: 1, profile, semesters, courses, tasks, calendarEvents };
  }

  /** Deletes the auth account; FK cascades remove every personal row. */
  async deleteAllData() {
    ok(await this.db.rpc('delete_my_account'));
    await this.db.auth.signOut();
  }
}
