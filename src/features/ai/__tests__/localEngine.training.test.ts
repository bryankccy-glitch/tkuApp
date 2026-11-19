import { describe, expect, it } from 'vitest';
import type { Course, Task, Weekday } from '@/lib/types';
import { answerLocally, findCourse } from '../localEngine';
import { referenceTime, resolveClock, resolveDay } from '../localTime';

// Entirely fictional timetable, rooms and teachers; never copy the external student's fixture.
const now = new Date(2028, 11, 28, 9, 30); // Thursday; following Monday is in another year.
function course(id: string, name: string, weekday: Weekday, startTime: string, endTime: string): Course {
  return { id, name, semesterId: 'fiction', instructor: `測試教師${id}`, color: 'blue', createdAt: '', updatedAt: '',
    slots: [{ id: `${id}-slot`, weekday, startTime, endTime, room: `TEST-${id}` }] };
}
const courses = [
  course('a', '作業系統幻想實驗', 3, '15:10', '17:00'),
  course('at', '作業系統幻想實驗（助教）', 3, '09:10', '10:00'),
  course('b', '經濟學星際專題', 4, '08:10', '10:00'),
  course('c', '個體經濟學星際專題', 5, '13:10', '15:00'),
  course('d', '程式設計與資料結構幻想演練', 5, '10:10', '12:00'),
  course('dt', '程式設計與資料結構幻想演練（助教）', 1, '11:10', '12:00'),
  course('e', '資訊安全實務基礎幻想演練', 1, '15:10', '17:00'),
  course('p', 'Python星際語言', 3, '12:10', '13:00'),
  course('en', '英文（二）星際討論', 5, '08:10', '10:00'),
];
function task(id: string, courseId: string, kind: Task['kind'], dueAt: string, completed = false): Task {
  return { id, title: `虛構待辦-${id}`, courseId, kind, dueAt, completed, priority: 'medium', remindMinutesBefore: null, createdAt: '', updatedAt: '' };
}
const tasks = [
  task('late', 'c', 'final', new Date(2029, 1, 20, 13, 0).toISOString()),
  task('quiz', 'a', 'quiz', new Date(2029, 0, 4, 15, 10).toISOString()),
  task('report', 'b', 'report', new Date(2028, 11, 29, 23, 59).toISOString()),
  task('done', 'a', 'homework', new Date(2029, 0, 2).toISOString(), true),
];
const ask = (question: string) => answerLocally({ question, courses, tasks, events: [], now }).content;

describe('local assistant training regressions', () => {
  it.each([
    ['OS', 'a'], ['OS的助教課', 'at'], ['程設', 'd'], ['程設 TA', 'dt'], ['資安', 'e'],
    ['个经', 'c'], ['Py', 'p'], ['python', 'p'], ['英文二', 'en'], ['英文2', 'en'],
  ])('resolves %s without inventing a course', (q, id) => {
    expect(findCourse(q, courses)?.id).toBe(id);
  });

  it('does not select an arbitrary course from a generic task query or tied partial name', () => {
    expect(findCourse('全部作業與考試', courses)).toBeUndefined();
    expect(findCourse('幻想', courses)).toBeUndefined();
    expect(findCourse('資安助教', courses)).toBeUndefined();
  });

  it('does not mistake course-name words for homework intent', () => {
    const content = ask('作業系統幻想實驗在哪上課');
    expect(content).toContain('TEST-a');
    expect(content).not.toContain('虛構待辦');
  });

  it('uses the requested instant and respects exact lesson end boundaries', () => {
    expect(ask('週三九點下課後下一堂課')).toContain('作業系統幻想實驗（助教）');
    expect(ask('週三 10:00 下一堂課')).toContain('Python星際語言');
    expect(ask('明天早上七點下一堂課')).toContain('英文（二）星際討論');
    expect(ask('週三12:30現在上什麼課')).toContain('Python星際語言');
    const after = ask('週三中午12點半以後第一堂課');
    expect(after).toContain('作業系統幻想實驗');
    expect(after).not.toContain('Python星際語言');
  });

  it('lists only the requested day, even with generic all-class language', () => {
    for (const q of ['12/29課表', '明天有哪些課', '星期五從早到晚', '12/29']) {
      expect(ask(q)).toContain('TEST-en');
      expect(ask(q)).not.toContain('TEST-a');
    }
    expect(ask('礼拜一整天課表')).toContain('12:00');
    expect(ask('週三幾點結束所有課')).toContain('17:00');
  });

  it('shows the exact named-course boundaries, including intervening lessons', () => {
    const content = ask('OS助教下課到OS上課中間幾點到幾點');
    expect(content).toContain('10:00–15:10');
    expect(content).toContain('Python星際語言');
    expect(ask('英文二下課到程設上課中間空檔')).toContain('10:00–10:10');
    expect(ask('資安下課到英文二上課中間空檔')).toContain('沒有可靠的資料');
  });

  it('lists every task kind in due order and excludes completed tasks', () => {
    const content = ask('全部作業與考試最近先到期');
    expect(content.indexOf('虛構待辦-report')).toBeLessThan(content.indexOf('虛構待辦-quiz'));
    expect(content.indexOf('虛構待辦-quiz')).toBeLessThan(content.indexOf('虛構待辦-late'));
    expect(content).not.toContain('虛構待辦-done');
    expect(ask('經濟學星際專題有考試嗎')).not.toContain('虛構待辦-late');
    expect(ask('個經期末什麼時候')).toContain('2/20');
  });

  it('uses calendar week and weekday windows rather than a rolling horizon', () => {
    expect(ask('下禮拜四小考')).toContain('1/4');
    expect(ask('下禮拜四小考')).toContain('15:10');
    expect(ask('下週考試')).not.toContain('虛構待辦-late');
    expect(ask('這週小考')).not.toContain('虛構待辦-quiz');
    expect(ask('下週三小考')).not.toContain('虛構待辦-quiz');
    expect(ask('期中報告待辦')).not.toContain('沒有登記考試');
  });

  it('separates individual period times and does not parse 下一節 as period one', () => {
    expect(ask('3、4節時間分開列')).toMatch(/10:10–11:00.*11:10–12:00/s);
    expect(ask('第十三、十四節')).toMatch(/20:10–21:00.*21:10–22:00/s);
    expect(ask('下一节课在哪里')).not.toContain('第 1 節是');
  });

  it.each([
    ['明天是幾號', '12/29'], ['昨天日期', '12/27'], ['下禮拜一是幾號', '1/1'],
    ['下週四 YYYY-MM-DD', '2029-01-04'], ['明天 YYYY-MM-DD', '2028-12-29'],
  ])('answers calendar dates across year boundaries: %s', (q, date) => {
    expect(ask(q)).toContain(date);
  });

  it.each(['OS老師電話', '明天公車幾點', '下學期有什麼課', '英文二老師email', '週三會停課嗎'])('rejects unsupported facts without a timetable: %s', (q) => {
    expect(ask(q)).toContain('沒有可靠的資料');
    expect(ask(q)).not.toContain('TEST-');
    expect(ask(q)).not.toMatch(/B\d{3}/);
  });
});

describe('assistant local date and clock parsing', () => {
  it.each([
    ['週三九點下課後', 540], ['中午十二點半', 750], ['下午三點十分', 910],
    ['晚上六點', 1080], ['上午十二點', 0], ['二十三點', 1380], ['12:30', 750],
  ])('parses %s', (q, minutes) => expect(resolveClock(q)).toBe(minutes));

  it('rejects invalid calendar dates and resolves leap days', () => {
    expect(resolveDay('2029-02-29', now)).toBeNull();
    expect(resolveDay('2028-02-29', now)?.date.getDate()).toBe(29);
    expect(resolveDay('11/31', now)).toBeNull();
  });

  it('starts an explicitly requested day at midnight, keeping implicit now intact', () => {
    expect(referenceTime('明天下一堂', now).getHours()).toBe(0);
    expect(referenceTime('下一堂', now).getTime()).toBe(now.getTime());
    expect(now.getHours()).toBe(9);
  });

  it('keeps the current time for 今天 without a clock time', () => {
    expect(referenceTime('今天下一堂', now).getTime()).toBe(now.getTime());
    expect(referenceTime('今天下午兩點後第一堂', now).getHours()).toBe(14);
  });
});

describe('course nicknames follow each student’s own course names', () => {
  const other: Course[] = [
    course('s1', '資訊安全概論', 2, '10:10', '12:00'),
    course('s2', '個體經濟學（一）', 4, '13:10', '15:00'),
    course('s3', '程式設計（二）', 1, '08:10', '10:00'),
    course('s4', '網際網路通訊協定', 3, '15:10', '17:00'),
  ];
  it.each([
    ['資安在哪上課', '資訊安全概論'],
    ['個經幾點', '個體經濟學（一）'],
    ['程設教室', '程式設計（二）'],
    ['想看網通的上課時間', '網際網路通訊協定'],
  ])('%s → %s', (q, name) => {
    expect(findCourse(q, other)?.name).toBe(name);
  });
  it('does not guess when a nickname fits two courses', () => {
    const two = [course('x1', '資料庫系統', 1, '08:10', '10:00'), course('x2', '資料結構', 2, '08:10', '10:00')];
    expect(findCourse('資系在哪', two)?.name).toBe('資料庫系統');
    expect(findCourse('資料在哪', two)).toBeUndefined();
  });
});
