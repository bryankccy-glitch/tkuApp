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

describe('local campus assistant — more questions', () => {
  // Wednesday 2026-10-14 10:30, in the middle of 網路與通訊.
  const wed = new Date(2026, 9, 14, 10, 30);
  const mk = (id: string, name: string, instructor: string | undefined, slots: [number, string, string, string][]): Course => ({
    id, semesterId: 's', name, instructor, color: 'blue', createdAt: '', updatedAt: '',
    slots: slots.map(([weekday, startTime, endTime, room], i) => ({ id: `${id}${i}`, weekday: weekday as 1, startTime, endTime, room })),
  });
  const cs: Course[] = [
    mk('n', '網路與通訊', '鄭培宇', [[3, '10:10', '12:00', 'B217']]),
    mk('nt', '網路與通訊（助教）', '助教', [[3, '12:10', '13:00', 'B217']]),
    mk('o', '作業系統', '魏世杰', [[3, '15:10', '17:00', 'B110']]),
    mk('e', '經濟學', '陳紹良', [[4, '08:10', '10:00', 'B607']]),
  ];
  const ts: Task[] = [
    { id: 'a', title: '第三章習題', kind: 'homework', courseId: 'e', dueAt: new Date(2026, 9, 16, 23, 59).toISOString(), priority: 'medium', completed: false, remindMinutesBefore: null, createdAt: '', updatedAt: '' },
    { id: 'b', title: 'Lab 2', kind: 'homework', courseId: 'o', dueAt: new Date(2026, 9, 15, 12, 0).toISOString(), priority: 'medium', completed: false, remindMinutesBefore: null, createdAt: '', updatedAt: '' },
    { id: 'c', title: '期中考', kind: 'midterm', courseId: 'e', dueAt: new Date(2026, 10, 5, 8, 10).toISOString(), priority: 'high', completed: false, remindMinutesBefore: null, createdAt: '', updatedAt: '' },
  ];
  const semester = { id: 's', code: '115-1', name: '115 學年度第 1 學期', startDate: '2026-09-14', endDate: '2027-01-15' };
  const q = (question: string, now = wed) => answerLocally({ question, courses: cs, tasks: ts, events: null, now, semester });

  it('knows the current class, when it ends and what comes next', () => {
    const r = q('現在在上什麼課？');
    expect(r.content).toContain('網路與通訊');
    expect(r.content).toContain('1 小時 30 分');
    expect(r.content).toContain('下課後接著是 **網路與通訊（助教）**');
    expect(r.sources.some((s) => s.url?.startsWith('https://www.google.com/maps'))).toBe(true);
  });

  it('finds the next class, also tomorrow, with a countdown', () => {
    expect(q('下一堂課在哪', new Date(2026, 9, 14, 13, 30)).content).toMatch(/作業系統.*15:10.*B110.*商管大樓.*還有 1 小時 40 分/s);
    expect(q('下一堂課', new Date(2026, 9, 14, 18, 0)).content).toContain('經濟學');
  });

  it('answers when classes end and where the free periods are', () => {
    expect(q('今天幾點下課？').content).toContain('**17:00**');
    const free = q('今天有空堂嗎');
    expect(free.content).toContain('13:00–15:10');
    expect(q('週五有空堂嗎').content).toContain('沒有排課');
  });

  it('answers about one course by (part of) its name', () => {
    const r = q('經濟在哪間教室上課？');
    expect(r.content).toContain('週四 08:10–10:00');
    expect(r.content).toContain('B607');
    expect(q('網路與通訊是誰教的').content).toContain('鄭培宇');
    expect(q('網路與通訊助教課在哪').content).toContain('12:10');
  });

  it('filters homework and exams by course', () => {
    const hw = q('經濟學有什麼作業');
    expect(hw.content).toContain('第三章習題');
    expect(hw.content).not.toContain('Lab 2');
    expect(q('經濟學什麼時候考試').content).toContain('期中考');
    expect(q('作業系統要考試嗎').content).toContain('沒有登記考試');
  });

  it('gives the week overview and the semester week', () => {
    const w = q('這週課表');
    expect(w.content).toContain('3 門課');
    expect(w.content).toMatch(/\*\*週三\*\*：10:10 網路與通訊（B217）、12:10/);
    expect(q('現在是第幾週？').content).toContain('第 **5** 週');
  });

  it('understands Simplified Chinese and Chinese period numbers', () => {
    expect(q('下一节课在哪里', new Date(2026, 9, 14, 13, 30)).content).toContain('作业系统'.replace('作业系统', '作業系統'));
    expect(q('这周有哪些作业').content).toContain('Lab 2');
    expect(q('第五節幾點').content).toContain('12:10–13:00');
  });

  it('answers in English', async () => {
    const { default: i18n } = await import('@/i18n');
    await i18n.changeLanguage('en');
    try {
      expect(q('where is my next class?', new Date(2026, 9, 14, 13, 30)).content).toMatch(/next class is \*\*作業系統\*\*.*15:10.*B110/s);
      expect(q('when do I finish today?').content).toContain('ending at **17:00**');
      expect(q('who teaches 經濟學?').content).toContain('陳紹良');
      expect(q('which week of the semester is it?').content).toContain('week **5**');
    } finally {
      await i18n.changeLanguage('zh-TW');
    }
  });

  it('introduces itself and links the map for buildings', () => {
    expect(q('你好').content).toContain('可以這樣問我');
    const b = q('B217 在哪棟？');
    expect(b.content).toContain('商管大樓');
    expect(b.sources[0]!.url).toMatch(/^https:\/\/www\.google\.com\/maps/);
  });
});
