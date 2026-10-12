import { describe, expect, it } from 'vitest';
import { commonFreeBlocks } from '../freeTime';
import { groupFriendSchedule } from '../supabaseSocial';
import type { Course, Weekday } from '../../types';

const course = (id: string, slots: [Weekday, string, string][]): Course => ({
  id, semesterId: 's', name: id, color: 'navy', createdAt: '', updatedAt: '',
  slots: slots.map(([weekday, startTime, endTime], i) => ({ id: `${id}${i}`, weekday, startTime, endTime, room: '' })),
});

describe('commonFreeBlocks', () => {
  it('merges periods both people have free into blocks', () => {
    const me = [course('a', [[1, '08:10', '10:00']])]; // Mon periods 1–2
    const friend = [course('b', [[1, '13:10', '15:00']])]; // Mon periods 6–7
    const mon = commonFreeBlocks([me, friend], [1]);
    expect(mon.map((b) => `${b.from}-${b.to}`)).toEqual(['3-5', '8-12']);
    expect(mon[0]).toMatchObject({ startTime: '10:10', endTime: '13:00' });
  });

  it('treats partial overlap as busy and an empty timetable as free all day', () => {
    const me = [course('a', [[2, '09:30', '09:50']])]; // inside period 2
    const day = commonFreeBlocks([me, []], [2]);
    expect(day.map((b) => `${b.from}-${b.to}`)).toEqual(['1-1', '3-12']);
  });

  it('returns nothing on a day someone is busy from first to last period', () => {
    const me = [course('a', [[3, '08:10', '20:00']])];
    expect(commonFreeBlocks([me, []], [3])).toEqual([]);
  });
});

describe('groupFriendSchedule', () => {
  it('groups flat RPC rows into courses with HH:mm slots', () => {
    const courses = groupFriendSchedule([
      { course_id: 'c1', name: '微積分', code: null, instructor: null, color: 'teal', entry_id: 'e1', weekday: 1, start_time: '08:10:00', end_time: '10:00:00', room: 'H112' },
      { course_id: 'c1', name: '微積分', code: null, instructor: null, color: 'teal', entry_id: 'e2', weekday: 3, start_time: '10:10:00', end_time: '12:00:00', room: 'H112' },
      { course_id: 'c2', name: '英文', code: 'E1', instructor: 'X', color: 'blue', entry_id: 'e3', weekday: 2, start_time: '13:10:00', end_time: '15:00:00', room: 'FL105' },
    ]);
    expect(courses).toHaveLength(2);
    expect(courses[0]!.slots.map((s) => `${s.weekday} ${s.startTime}-${s.endTime}`)).toEqual(['1 08:10-10:00', '3 10:10-12:00']);
    expect(courses[0]).not.toHaveProperty('notes', expect.anything());
  });
});
