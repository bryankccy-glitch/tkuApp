import { describe, expect, it } from 'vitest';
import { dueClassReminders, dueFriendNotices, dueTaskReminders, runPushReminders, type Sub, type PushMessage } from '../push-reminders.js';
import type { EntryRow } from '../widget.js';

const e = (weekday: number, start: string, end: string, name: string, room = 'B217'): EntryRow => ({ weekday, start_time: `${start}:00`, end_time: `${end}:00`, room, name });
// Monday 2026-10-19 in Taipei
const at = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+08:00`);

describe('push reminder timing', () => {
  const rows = [e(1, '08:10', '09:00', '統計學'), e(1, '09:10', '10:00', '統計學'), e(1, '13:10', '14:00', '英文', 'FL105'), e(2, '08:10', '09:00', '會計')];

  it('fires a class reminder at start − minutes, once per back-to-back block', () => {
    expect(dueClassReminders(rows, 10, at('07:59'))).toEqual([]);
    const due = dueClassReminders(rows, 10, at('08:00'));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ id: 'class:2026-10-19:08:10:統計學', title: '10 分鐘後上課：統計學' });
    expect(due[0]!.body).toContain('B217（商管大樓）');
    expect(dueClassReminders(rows, 10, at('09:00'))).toEqual([]); // continuation of 統計學
    expect(dueClassReminders(rows, 10, at('13:02'))[0]?.title).toBe('10 分鐘後上課：英文'); // 2 min late still ok
    expect(dueClassReminders(rows, 10, at('13:06'))).toEqual([]); // too late
    expect(dueClassReminders(rows, 0, at('08:00'))).toEqual([]);
  });

  it('fires a task reminder at due − remind_minutes_before', () => {
    const t = { id: 't1', title: '期中報告', kind: 'report', due_at: '2026-10-19T12:00:00+08:00', remind_minutes_before: 60 };
    expect(dueTaskReminders([t], at('10:59'))).toEqual([]);
    expect(dueTaskReminders([t], at('11:00'))[0]).toMatchObject({ title: '報告即將截止：期中報告' });
    expect(dueTaskReminders([{ ...t, remind_minutes_before: null }], at('11:00'))).toEqual([]);
  });
});

describe('runPushReminders', () => {
  it('honors each device’s class lead time and task setting without repeat deliveries', async () => {
    const subs: Sub[] = [
      { endpoint: 'https://fcm.googleapis.com/off', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 0, tasks: false },
      { endpoint: 'https://fcm.googleapis.com/ten', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 10, tasks: false },
      { endpoint: 'https://fcm.googleapis.com/five', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 5, tasks: true },
    ];
    const claims = new Set<string>();
    const db = { from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'or', 'gte', 'lte', 'not']) q[method] = () => q;
      q.insert = async (row: { reminder_id: string }) => {
        if (claims.has(row.reminder_id)) return { error: { code: '23505' } };
        claims.add(row.reminder_id);
        return { error: null };
      };
      q.then = (resolve: (value: unknown) => void) => resolve({ error: null, data:
        table === 'push_subscriptions' ? subs :
        table === 'schedule_entries' ? [{ weekday: 1, start_time: '08:10:00', end_time: '09:00:00', room: 'B217', user_courses: { name: '統計學', semester_id: 's1' } }] :
        table === 'semesters' ? [{ id: 's1', start_date: '2026-09-01', end_date: '2027-01-31' }] :
        table === 'tasks' ? [{ id: 't1', title: 'Task', kind: 'personal', due_at: '2026-10-19T08:10:00+08:00', remind_minutes_before: 10 }] :
        table === 'friendships' ? [{ id: 'f1', requester: 'u2', addressee: 'u1', status: 'pending', created_at: at('08:00').toISOString(), updated_at: at('08:00').toISOString() }] : [] });
      return q;
    } } as never;
    const delivered: string[] = [];
    const send = async (sub: Sub, msg: PushMessage) => { delivered.push(`${sub.endpoint.split('/').pop()}|${msg.title}`); };
    expect((await runPushReminders(db, send, at('08:00'))).sent).toBe(5);
    expect(delivered).toEqual([
      'ten|10 分鐘後上課：統計學', 'five|待辦即將截止：Task',
      'off|新的好友邀請', 'ten|新的好友邀請', 'five|新的好友邀請',
    ]);
    expect((await runPushReminders(db, send, at('08:01'))).sent).toBe(0);
    expect((await runPushReminders(db, send, at('08:05'))).sent).toBe(1);
    expect(delivered[5]).toBe('five|5 分鐘後上課：統計學');
    expect((await runPushReminders(db, send, at('08:06'))).sent).toBe(0);
    expect(delivered).toHaveLength(6);
  });
  it('releases an all-failed delivery for the next cron retry, but retains successful claims', async () => {
    const sub: Sub = { endpoint: 'https://fcm.googleapis.com/a', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 10, tasks: false };
    let claimed = false;
    const db = { from: (table: string) => {
      let remove = false;
      const q: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'in', 'or', 'gte']) q[name] = () => q;
      q.delete = () => { remove = true; return q; };
      q.insert = async () => { if (claimed) return { error: { code: '23505' } }; claimed = true; return { error: null }; };
      q.then = (resolve: (value: unknown) => void) => {
        if (remove) { claimed = false; resolve({ error: null }); return; }
        const data = table === 'push_subscriptions' ? [sub]
          : table === 'schedule_entries' ? [{ weekday: 1, start_time: '08:10:00', end_time: '09:00:00', room: 'B217', user_courses: { name: '統計學', semester_id: 's1' } }]
          : table === 'semesters' ? [{ id: 's1', start_date: '2026-09-01', end_date: '2027-01-31' }] : [];
        resolve({ data, error: null });
      };
      return q;
    } } as never;
    const failed = await runPushReminders(db, async () => { throw new Error('network failure'); }, at('08:00'));
    expect(failed.failed).toBe(1);
    expect(claimed).toBe(false);
    const retry = await runPushReminders(db, async () => {}, at('08:01'));
    expect(retry.sent).toBe(1);
    expect(claimed).toBe(true);
    expect((await runPushReminders(db, async () => { throw new Error('must not resend'); }, at('08:02'))).sent).toBe(0);
  });
  it('sends each reminder once to every device and drops dead subscriptions', async () => {
    const subs: Sub[] = [
      { endpoint: 'https://fcm.googleapis.com/a', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 10, tasks: true },
      { endpoint: 'https://fcm.googleapis.com/gone', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 10, tasks: true },
      { endpoint: 'https://evil.example/x', user_id: 'u1', p256dh: 'k', auth: 'a', class_minutes: 10, tasks: true },
    ];
    const sentIds = new Set<string>();
    const deleted: string[] = [];
    const q = (table: string) => {
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === 'push_subscriptions') return { data: subs, error: null };
        if (table === 'schedule_entries') return { data: [{ weekday: 1, start_time: '08:10:00', end_time: '09:00:00', room: 'B217', user_courses: { name: '統計學', semester_id: 's1' } }], error: null };
        if (table === 'semesters') return { data: [{ id: 's1', start_date: '2026-09-01', end_date: '2027-01-31' }], error: null };
        return { data: [], error: null };
      };
      for (const m of ['select', 'eq', 'not', 'gte', 'lte', 'in', 'or']) chain[m] = () => chain;
      chain.then = (ok: (v: unknown) => void) => ok(result());
      chain.insert = async (row: { reminder_id: string }) => {
        if (sentIds.has(row.reminder_id)) return { error: { code: '23505' } };
        sentIds.add(row.reminder_id);
        return { error: null };
      };
      chain.delete = () => {
        const removal = {
          eq: (column: string, value: string) => {
            if (table === 'push_subscriptions' && column === 'endpoint') {
              deleted.push(value);
              const index = subs.findIndex((sub) => sub.endpoint === value);
              if (index >= 0) subs.splice(index, 1);
            }
            if (table === 'push_sent' && column === 'reminder_id') sentIds.delete(value);
            return removal;
          },
          then: (resolve: (value: unknown) => void) => resolve({ error: null }),
        };
        return removal;
      };
      return chain;
    };
    const db = { from: q } as never;
    const delivered: string[] = [];
    const send = async (s: Sub, m: PushMessage) => {
      expect(s.endpoint).not.toContain('evil.example');
      if (s.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      delivered.push(`${s.endpoint}|${m.id}`);
    };
    const first = await runPushReminders(db, send, at('08:00'));
    expect(first).toMatchObject({ users: 1, sent: 1, removed: 2 });
    expect(deleted).toEqual(['https://evil.example/x', 'https://fcm.googleapis.com/gone']);
    const again = await runPushReminders(db, send, at('08:01'));
    expect(again.sent).toBe(0); // already sent
    expect(delivered).toEqual(['https://fcm.googleapis.com/a|class:2026-10-19:08:10:統計學']);
  });
});

describe('friend notices', () => {
  it('tells the addressee about a new request and the requester when it is accepted', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const names = new Map([['a', '小明'], ['b', '小華']]);
    const rows = [
      { id: 'f1', requester: 'a', addressee: 'b', status: 'pending', created_at: '2026-10-20T11:58:00Z', updated_at: '2026-10-20T11:58:00Z' },
      { id: 'f2', requester: 'b', addressee: 'a', status: 'accepted', created_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-20T11:59:00Z' },
      { id: 'f3', requester: 'a', addressee: 'b', status: 'pending', created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' },
    ];
    expect(dueFriendNotices(rows, names, 'b', now)).toEqual([
      expect.objectContaining({ id: 'friend:req:f1', body: expect.stringContaining('小明') }),
      expect.objectContaining({ id: 'friend:acc:f2', body: expect.stringContaining('小明') }),
    ]);
    expect(dueFriendNotices(rows, names, 'a', now)).toEqual([]);
  });
});
