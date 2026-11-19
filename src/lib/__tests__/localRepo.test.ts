import { describe, expect, it } from 'vitest';
import { LocalRepository } from '../data/local';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}

describe('LocalRepository CRUD', () => {
  it('creates, edits and deletes courses; unlinks tasks on delete', async () => {
    const repo = new LocalRepository(memStorage());
    const [sem] = await repo.listSemesters();
    const c = await repo.upsertCourse({ semesterId: sem!.id, name: '微積分', color: 'navy', slots: [{ weekday: 1, startTime: '08:10', endTime: '10:00', room: 'S101' }] });
    expect((await repo.listCourses(sem!.id))).toHaveLength(1);
    await repo.upsertCourse({ ...c, name: '微積分（一）' });
    expect((await repo.listCourses(sem!.id))[0]!.name).toBe('微積分（一）');
    const task = await repo.upsertTask({ title: '習題', kind: 'homework', courseId: c.id, dueAt: new Date().toISOString(), priority: 'low', completed: false, remindMinutesBefore: null });
    await repo.deleteCourse(c.id);
    expect(await repo.listCourses(sem!.id)).toHaveLength(0);
    expect((await repo.listTasks()).find((t) => t.id === task.id)!.courseId).toBeNull();
  });

  it('deletes every course of one semester only, keeping tasks but unlinking them', async () => {
    const repo = new LocalRepository(memStorage());
    const [sem] = await repo.listSemesters();
    const other = await repo.upsertSemester({ code: '114-2', name: '114 學年度第 2 學期', startDate: '2026-02-16', endDate: '2026-06-20' });
    const slot = { weekday: 2 as const, startTime: '08:10', endTime: '10:00', room: 'B217' };
    const a = await repo.upsertCourse({ semesterId: sem!.id, name: '投資學', color: 'navy', slots: [slot] });
    await repo.upsertCourse({ semesterId: sem!.id, name: '體育－高爾夫', color: 'navy', slots: [slot] });
    await repo.upsertCourse({ semesterId: other.id, name: '會計學', color: 'navy', slots: [slot] });
    const task = await repo.upsertTask({ title: '報告', kind: 'homework', courseId: a.id, dueAt: new Date().toISOString(), priority: 'low', completed: false, remindMinutesBefore: null });
    expect(await repo.deleteCoursesInSemester(sem!.id)).toBe(2);
    expect(await repo.listCourses(sem!.id)).toHaveLength(0);
    expect((await repo.listCourses(other.id)).map((c) => c.name)).toEqual(['會計學']);
    expect((await repo.listTasks()).find((t) => t.id === task.id)!.courseId).toBeNull();
    expect(await repo.deleteCoursesInSemester(sem!.id)).toBe(0);
  });

  it('persists across instances and wipes on deleteAllData', async () => {
    const storage = memStorage();
    const r1 = new LocalRepository(storage);
    await r1.updateProfile({ displayName: '小淡' });
    expect((await new LocalRepository(storage).getProfile())!.displayName).toBe('小淡');
    await r1.deleteAllData();
    expect(await new LocalRepository(storage).getProfile()).toBeNull();
  });

  it('sets completedAt when completing a task', async () => {
    const repo = new LocalRepository(memStorage());
    const t = await repo.upsertTask({ title: 'x', kind: 'personal', dueAt: new Date().toISOString(), priority: 'high', completed: false, remindMinutesBefore: 60 });
    const done = await repo.upsertTask({ ...t, completed: true });
    expect(done.completedAt).toBeTruthy();
    const undone = await repo.upsertTask({ ...done, completed: false });
    expect(undone.completedAt).toBeNull();
  });
});
