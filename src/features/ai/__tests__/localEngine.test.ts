import { describe, expect, it } from 'vitest';
import { answerLocally } from '../localEngine';
import type { Course, Task } from '@/lib/types';

const now = new Date(2026, 9, 12, 7, 0); // Monday 07:00
const courses: Course[] = [
  { id: 'c1', semesterId: 's', name: '資料結構', instructor: '王老師', color: 'blue', createdAt: '', updatedAt: '',
    slots: [{ id: 'x', weekday: 2, startTime: '10:10', endTime: '12:00', room: 'E304' }, { id: 'y', weekday: 2, startTime: '08:10', endTime: '09:00', room: 'FL105' }] },
];
const tasks: Task[] = [
  { id: 't1', title: '期中考', kind: 'midterm', courseId: 'c1', dueAt: new Date(2026, 9, 20, 10, 10).toISOString(), priority: 'high', completed: false, remindMinutesBefore: null, createdAt: '', updatedAt: '' },
];
const ask = (question: string, events = null) => answerLocally({ question, courses, tasks, events, now });

describe('local campus assistant', () => {
  it('answers first class tomorrow from personal schedule with building name', () => {
    const r = ask('明天第一堂課在哪裡？');
    expect(r.content).toContain('08:10');
    expect(r.content).toContain('FL105');
    expect(r.content).toContain('外國語文大樓');
    expect(r.sources[0]!.kind).toBe('personal');
  });
  it('lists upcoming exams', () => {
    expect(ask('幫我整理接下來的考試').content).toContain('資料結構');
  });
  it('cites official document and refuses to invent rules', () => {
    const r = ask('淡江病假怎麼請？');
    expect(r.sources[0]!.title).toBe('淡江大學學生請假規則');
    expect(r.sources[0]!.url).toMatch(/^https:\/\/sa\.tku\.edu\.tw/);
    expect(r.content).toContain('不會自行推測');
  });
  it('maps room code to building', () => {
    expect(ask('HC306 在哪一棟？').content).toContain('守謙國際會議中心');
  });
  it('answers period times from verified table', () => {
    expect(ask('第 5 節是幾點？').content).toContain('12:10–13:00');
  });
  it('says so when events are unavailable instead of inventing', () => {
    expect(ask('這週有哪些活動？').content).toContain('不會提供來源不明');
  });
  it('admits when it cannot answer', () => {
    expect(ask('學餐今天吃什麼').content).toContain('沒有可靠的資料');
  });
});
