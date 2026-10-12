import { describe, expect, it } from 'vitest';
import { coursesToCsv, csvToCourses, parseCsv } from '../csv';
import type { Course } from '../types';

describe('csv', () => {
  it('parses quoted cells with commas and newlines', () => {
    expect(parseCsv('a,"b,c","d\n""e"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd\n"e"'], ['1', '2', '3']]);
  });

  it('merges rows of the same course and accepts Chinese weekdays', () => {
    const r = csvToCourses('課程名稱,課號,教授,星期,開始,結束,教室,顏色,備註\n資料結構,,王,2,10:10,12:00,E304,blue,\n資料結構,,王,四,13:10,14:00,E304,blue,');
    expect(r.errors).toEqual([]);
    expect(r.courses).toHaveLength(1);
    expect(r.courses[0]!.slots.map((s) => s.weekday)).toEqual([2, 4]);
    expect(r.courses[0]!.color).toBe('blue');
  });

  it('reports invalid rows with line numbers', () => {
    const r = csvToCourses('課程名稱,課號,教授,星期,開始,結束,教室\nX,,,8,10:00,11:00,E1\nY,,,1,11:00,10:00,E1');
    expect(r.courses).toHaveLength(0);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('round-trips export → import and neutralises formula injection', () => {
    const c: Course = {
      id: '1', semesterId: 's', name: '=HYPERLINK("x")', color: 'teal', notes: 'a, b',
      slots: [{ id: 's1', weekday: 3, startTime: '08:10', endTime: '09:00', room: 'H112' }], createdAt: '', updatedAt: '',
    };
    const csv = coursesToCsv([c]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    const back = csvToCourses(csv);
    expect(back.courses[0]!.name).toBe('=HYPERLINK("x")');
    expect(back.courses[0]!.notes).toBe('a, b');
  });
});
