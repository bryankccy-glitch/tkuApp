import { describe, expect, it } from 'vitest';
import { hashToken, mergeSlots, pickNext, taipeiClock, type EntryRow } from '../widget.js';

const e = (weekday: number, start: string, end: string, name: string, room = 'B217'): EntryRow =>
  ({ weekday, start_time: `${start}:00`, end_time: `${end}:00`, room, name });

describe('widget data', () => {
  it('reads the clock in Taipei time', () => {
    // 2026-10-19 01:30 UTC = Monday 09:30 in Taipei
    expect(taipeiClock(new Date('2026-10-19T01:30:00Z'))).toEqual({ weekday: 1, minutes: 570, date: '2026-10-19' });
    // Sunday 23:30 UTC = Monday 07:30 in Taipei
    expect(taipeiClock(new Date('2026-10-18T23:30:00Z')).weekday).toBe(1);
  });

  it('merges back-to-back periods of the same course', () => {
    const slots = mergeSlots([e(1, '10:10', '11:00', '統計學'), e(1, '08:10', '09:00', '統計學'), e(1, '09:10', '10:00', '統計學'), e(1, '13:10', '14:00', '英文', 'FL105')]);
    expect(slots).toEqual([
      { name: '統計學', start: '08:10', end: '11:00', room: 'B217' },
      { name: '英文', start: '13:10', end: '14:00', room: 'FL105' },
    ]);
  });

  it('picks the class in progress, then the next one, then the coming days', () => {
    const rows = [e(1, '08:10', '10:00', '統計學'), e(1, '13:10', '15:00', '英文'), e(3, '10:10', '12:00', '會計')];
    expect(pickNext(rows, 1, 9 * 60)).toMatchObject({ name: '統計學', status: 'now', dayOffset: 0 });
    expect(pickNext(rows, 1, 11 * 60)).toMatchObject({ name: '英文', status: 'next', dayOffset: 0 });
    expect(pickNext(rows, 1, 16 * 60)).toMatchObject({ name: '會計', dayOffset: 2 });
    expect(pickNext(rows, 4, 8 * 60)).toMatchObject({ name: '統計學', dayOffset: 4 }); // Thu → next Mon
    expect(pickNext([], 1, 0)).toBeNull();
  });

  it('stores only a sha-256 hash of the token', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
