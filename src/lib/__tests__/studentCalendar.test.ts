import { describe, expect, it } from 'vitest';
import { calendarItemsOn, monthDates, taipeiDayKey } from '../studentCalendar';
import { courseTitle } from '../courseTitle';
import type { CalendarEvent, Course, Semester, Task } from '../types';
import { LocalRepository } from '../data/local';
import { memoryStorage } from '@/test/memoryStorage';

const semester: Semester = { id: 's', name: '115-1', code: '115-1', startDate: '2026-09-01', endDate: '2027-01-31' };
const course: Course = { id: 'c', semesterId: 's', name: '經濟學', instructor: '老師甲', color: 'navy', createdAt: '', updatedAt: '', slots: [{ id: 'sl', weekday: 2, startTime: '08:10', endTime: '10:00', room: 'B607' }] };
const event: CalendarEvent = { id: 'e', title: '排班', kind: 'work', startsAt: '2026-10-13T18:00:00+08:00', endsAt: '2026-10-13T20:00:00+08:00', location: '自行填寫', notes: '', repeat: 'weekly', repeatUntil: '2026-10-27', createdAt: '', updatedAt: '' };
const task: Task = { id: 't', title: '作業', kind: 'homework', dueAt: '2026-10-13T15:59:00Z', priority: 'medium', completed: false, remindMinutesBefore: null, createdAt: '', updatedAt: '' };

describe('student calendar', () => {
  it('renders six Monday-start weeks across year boundaries', () => {
    const dates = monthDates(2027, 0);
    expect(dates).toHaveLength(42);
    expect(dates[0]).toBe('2026-12-28');
    expect(dates[41]).toBe('2027-02-07');
    expect(monthDates(2028, 1)).toContain('2028-02-29');
  });
  it('unifies real class minutes, tasks and private entries in Taipei time', () => {
    const items = calendarItemsOn('2026-10-13', [course], [task], [event], semester);
    expect(items.map((item) => [item.title, item.time])).toEqual([['經濟學（老師甲）', '08:10'], ['排班', '18:00'], ['作業', '23:59']]);
    expect(taipeiDayKey(new Date('2026-10-13T16:00:00Z'))).toBe('2026-10-14');
  });
  it('limits recurring classes to the semester and work to its repeat-until date', () => {
    expect(calendarItemsOn('2026-10-20', [], [], [event])).toHaveLength(1);
    expect(calendarItemsOn('2026-10-21', [], [], [event])).toHaveLength(0);
    expect(calendarItemsOn('2026-11-03', [], [], [event])).toHaveLength(0);
    expect(calendarItemsOn('2026-08-25', [course], [], [], semester)).toHaveLength(0);
    expect(calendarItemsOn('2027-02-02', [course], [], [], semester)).toHaveLength(0);
  });
  it('includes overnight appointments on both occupied days, but not at their end boundary', () => {
    const overnight = { ...event, repeat: 'none' as const, startsAt: '2026-12-31T23:00:00+08:00', endsAt: '2027-01-01T01:00:00+08:00' };
    expect(calendarItemsOn('2026-12-31', [], [], [overnight])[0]?.endTime).toBe('24:00');
    expect(calendarItemsOn('2027-01-01', [], [], [overnight])[0]?.time).toBe('00:00');
    expect(calendarItemsOn('2027-01-02', [], [], [overnight])).toHaveLength(0);
  });
  it('does not duplicate an existing TA or teacher suffix', () => {
    expect(courseTitle({ name: '經濟學（助教）', instructor: '助教' })).toBe('經濟學（助教）');
    expect(courseTitle({ name: '經濟學', instructor: '' })).toBe('經濟學');
  });
  it('persists and edits calendar events through DataRepository and includes them in export / delete', async () => {
    const storage = memoryStorage();
    const repo = new LocalRepository(storage);
    const saved = await repo.upsertCalendarEvent(event);
    const reloaded = new LocalRepository(storage);
    expect(await reloaded.listCalendarEvents()).toHaveLength(1);
    await reloaded.upsertCalendarEvent({ ...saved, title: '已改排班' });
    expect((await reloaded.exportAll()).calendarEvents[0]?.title).toBe('已改排班');
    await reloaded.deleteCalendarEvent(saved.id);
    expect(await reloaded.listCalendarEvents()).toEqual([]);
    await reloaded.upsertCalendarEvent(event);
    await reloaded.deleteAllData();
    expect(await reloaded.listCalendarEvents()).toEqual([]);
  });
});
