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
