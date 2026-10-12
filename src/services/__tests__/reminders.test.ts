import { describe, expect, it } from 'vitest';
import { remindersBetween, DEFAULT_PREFS } from '../reminders';
import type { Course, Task } from '@/lib/types';
import { weekdayOf } from '@/lib/time';

const now = new Date(2026, 9, 14, 9, 55); // Wed 09:55 local
const course: Course = {
  id: 'c', semesterId: 's', name: '資料結構', instructor: '王老師', color: 'blue', createdAt: '', updatedAt: '',
  slots: [{ id: 'x', weekday: weekdayOf(now), startTime: '10:10', endTime: '12:00', room: 'E304' }],
};
const task = (mins: number | null, dueInMin: number, completed = false): Task => ({
  id: `t${mins}${dueInMin}`, title: '報告', kind: 'report', dueAt: new Date(now.getTime() + dueInMin * 60_000).toISOString(), priority: 'high',
  completed, remindMinutesBefore: mins, createdAt: '', updatedAt: '',
});
const on = { ...DEFAULT_PREFS, enabled: true };
const window = (fromMin: number, toMin: number) => [now.getTime() + fromMin * 60_000, now.getTime() + toMin * 60_000] as const;

describe('remindersBetween', () => {
  it('reminds N minutes before class with room and building', () => {
    const [a, b] = window(0, 10);
    const r = remindersBetween([course], [], on, a, b);
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBe('10 分鐘後上課：資料結構');
    expect(r[0]!.body).toContain('E304（工學大樓）');
    expect(new Date(r[0]!.at).getHours() * 60 + new Date(r[0]!.at).getMinutes()).toBe(10 * 60);
  });

  it('respects each task’s own reminder and skips completed or unset ones', () => {
    const [a, b] = window(0, 30);
    const r = remindersBetween([], [task(60, 70), task(60, 70, true), task(null, 20), task(1440, 70)], on, a, b);
    expect(r.map((x) => x.id.split(':')[1])).toEqual([task(60, 70).id]);
  });

  it('does nothing when disabled or class reminders are off', () => {
    const [a, b] = window(0, 60);
    expect(remindersBetween([course], [task(30, 40)], DEFAULT_PREFS, a, b)).toEqual([]);
    expect(remindersBetween([course], [], { ...on, classMinutes: 0 }, a, b)).toEqual([]);
  });
});
