import { describe, expect, it } from 'vitest';
import { SupabaseRepository } from '../supabaseRepo';

/** Records the order of schedule_entries writes and can fail the insert. */
function fakeDb(failInsert = false) {
  const log: string[] = [];
  const done = (data: unknown, error: unknown = null) => ({ data, error });
  const db = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      let action = 'read';
      for (const name of ['select', 'eq', 'in', 'order']) {
        chain[name] = () => chain;
      }
      chain.upsert = () => chain;
      chain.single = async () => done(table === 'user_courses' && action === 'read' ? { id: 'c1', semester_id: 's', name: 'n', schedule_entries: [] } : { id: 'c1' });
      chain.insert = async () => {
        log.push('insert');
        return failInsert ? done(null, { message: 'no' }) : done(null);
      };
      chain.delete = () => {
        action = 'delete';
        return chain;
      };
      chain.then = (ok: (v: unknown) => void) => {
        if (action === 'delete') log.push('delete');
        ok(done(action === 'delete' ? null : [{ id: 'old' }]));
      };
      return chain;
    },
  };
  return { db, log };
}

const input = { id: 'c1', semesterId: 's', name: 'n', slots: [{ weekday: 1, startTime: '08:10', endTime: '09:00', room: '' }] };

describe('upsertCourse', () => {
  it('writes the new slots before removing the old ones', async () => {
    const { db, log } = fakeDb();
    await new SupabaseRepository(db as never, 'u1').upsertCourse(input as never);
    expect(log).toEqual(['insert', 'delete']);
  });

  it('keeps the old slots when the insert fails', async () => {
    const { db, log } = fakeDb(true);
    await expect(new SupabaseRepository(db as never, 'u1').upsertCourse(input as never)).rejects.toBeTruthy();
    expect(log).toEqual(['insert']);
  });
});
