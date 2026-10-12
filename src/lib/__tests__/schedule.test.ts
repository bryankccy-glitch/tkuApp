import { describe, expect, it } from 'vitest';
import { conflictsFor, findConflicts, findNextClass, occurrencesOn, validateSlot } from '../schedule';
import type { Course } from '../types';

const course = (id: string, slots: Course['slots']): Course => ({
  id, semesterId: 's', name: id, color: 'navy', slots, createdAt: '', updatedAt: '',
});
const a = course('A', [{ id: 'a1', weekday: 1, startTime: '08:10', endTime: '10:00', room: 'E304' }]);
const b = course('B', [{ id: 'b1', weekday: 1, startTime: '09:10', endTime: '11:00', room: 'B201' }]);
const c = course('C', [{ id: 'c1', weekday: 1, startTime: '10:10', endTime: '12:00', room: 'FL105' }]);

describe('schedule conflicts', () => {
  it('detects overlapping slots on the same day', () => {
    expect(findConflicts([a, b])).toHaveLength(1);
  });
  it('treats back-to-back classes as non-conflicting', () => {
    expect(findConflicts([a, c])).toHaveLength(0);
  });
  it('ignores the course being edited', () => {
    expect(conflictsFor(a, [a])).toHaveLength(0);
    expect(conflictsFor({ id: 'new', slots: b.slots }, [a])).toHaveLength(1);
  });
  it('validates end after start', () => {
    expect(validateSlot({ startTime: '10:00', endTime: '09:00' })).toBeTruthy();
    expect(validateSlot({ startTime: '08:10', endTime: '09:00' })).toBeNull();
  });
});

describe('next class', () => {
  it('returns ongoing class during class time', () => {
    const mon = new Date(2026, 9, 12, 8, 30); // Monday
    const n = findNextClass([a, c], mon)!;
    expect(n.course.id).toBe('A');
    expect(n.ongoing).toBe(true);
  });
  it('rolls over to next week when today is done', () => {
    const monEvening = new Date(2026, 9, 12, 20, 0);
    const n = findNextClass([a], monEvening)!;
    expect(n.startsAt.getDate()).toBe(19);
  });
  it('sorts occurrences by start time', () => {
    expect(occurrencesOn([c, a], 1).map((o) => o.course.id)).toEqual(['A', 'C']);
  });
});

import { cn } from '../cn';
describe('cn', () => {
  it('keeps text color alongside custom font-size tokens', () => {
    expect(cn('text-white', 'text-caption')).toBe('text-white text-caption');
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
  });
});
