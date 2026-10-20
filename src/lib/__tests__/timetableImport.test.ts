import { describe, expect, it } from 'vitest';
import { cellsToCourses, normalizeRoom, type ImportCell } from '../timetableImport';

const c = (weekday: number, period: number, group: string, course: string, teacher: string, room: string): ImportCell => ({ weekday, period, group, course, teacher, room });

/** Cells transcribed from a real 淡江選課系統 課表 screenshot supplied by the developer. */
const SAMPLE: ImportCell[] = [
  c(1, 4, '資管二', '程式設計與資料結構', '助　教', 'B 217'),
  c(1, 6, '未來學學門', '教育未來', '陳錫珍', 'SG 321'),
  c(1, 7, '未來學學門', '教育未來', '陳錫珍', 'SG 321'),
  c(1, 8, '共同科', '資訊安全實務基礎', '鄭培宇', 'B 217'),
  c(1, 9, '共同科', '資訊安全實務基礎', '鄭培宇', 'B 217'),
  c(1, 10, '共同科', '資訊安全實務基礎', '助　教', 'B 217'),
  c(2, 7, '', '男、女生體育- 高爾夫球興趣班', '蕭淑芬', ''),
  c(2, 8, '', '男、女生體育- 高爾夫球興趣班', '蕭淑芬', ''),
  c(3, 1, '資管二', '經濟學', '助　教', 'B 118'),
  c(3, 2, '資管二', '作業系統', '助　教', 'B 118'),
  c(3, 3, '資管二', '網路與通訊', '鄭培宇', 'B 217'),
  c(3, 4, '資管二', '網路與通訊', '鄭培宇', 'B 217'),
  c(3, 5, '資管二', '網路與通訊', '助　教', 'B 217'),
  c(3, 8, '資管二', '作業系統', '魏世杰', 'B 110'),
  c(3, 9, '資管二', '作業系統', '魏世杰', 'B 110'),
  c(4, 1, '資管二', '經濟學', '陳紹良', 'B 607'),
  c(4, 2, '資管二', '經濟學', '陳紹良', 'B 607'),
  c(4, 3, '國企系經管二', '投資學', '薛勝斌', 'B 606'),
  c(4, 4, '國企系經管二', '投資學', '薛勝斌', 'B 606'),
  c(4, 6, '資訊教育學門', 'Python程式語言', '黃子嘉', 'B 130'),
  c(4, 7, '資訊教育學門', 'Python程式語言', '黃子嘉', 'B 130'),
  c(4, 8, '資管二', '程式設計與資料結構', '鄭元成', 'B 130'),
  c(5, 1, '共同科', '英文（二）', '李金安', 'SG 314'),
  c(5, 2, '共同科', '英文（二）', '李金安', 'SG 314'),
  c(5, 3, '資管二', '程式設計與資料結構', '鄭元成', 'B 217'),
  c(5, 4, '資管二', '程式設計與資料結構', '鄭元成', 'B 217'),
  c(5, 6, '外交二', '個體經濟學', '李文基', 'T 310'),
  c(5, 7, '外交二', '個體經濟學', '李文基', 'T 310'),
];

const summary = (r: ReturnType<typeof cellsToCourses>) =>
  Object.fromEntries(r.courses.map((x) => [x.name, { instructor: x.instructor, slots: x.slots.map((s) => `${s.weekday} ${s.startTime}-${s.endTime} ${s.room}`) }]));

describe('cellsToCourses (淡江 timetable screenshot)', () => {
  it('keeps the 11 course names as 16 separate lecture / TA entries with correctly timed slots', () => {
    const r = cellsToCourses(SAMPLE);
    expect(r.courses).toHaveLength(16);
    expect(r.skipped).toEqual([]);
    const s = summary(r);
    // Same course across days, rooms and a TA session; lecturer chosen over 助教.
    expect(s['程式設計與資料結構']).toEqual({ instructor: '鄭元成', slots: ['4 15:10-16:00 B130', '5 10:10-12:00 B217'] });
    expect(s['程式設計與資料結構（助教）']).toEqual({ instructor: '助教', slots: ['1 11:10-12:00 B217'] });
    expect(s['網路與通訊']).toEqual({ instructor: '鄭培宇', slots: ['3 10:10-12:00 B217'] });
    expect(s['網路與通訊（助教）']).toEqual({ instructor: '助教', slots: ['3 12:10-13:00 B217'] });
    expect(s['資訊安全實務基礎']).toEqual({ instructor: '鄭培宇', slots: ['1 15:10-17:00 B217'] });
    expect(s['資訊安全實務基礎（助教）']).toEqual({ instructor: '助教', slots: ['1 17:10-18:00 B217'] });
    expect(s['經濟學']).toEqual({ instructor: '陳紹良', slots: ['4 08:10-10:00 B607'] });
    expect(s['經濟學（助教）']).toEqual({ instructor: '助教', slots: ['3 08:10-09:00 B118'] });
    expect(s['作業系統']).toEqual({ instructor: '魏世杰', slots: ['3 15:10-17:00 B110'] });
    expect(s['男、女生體育- 高爾夫球興趣班']).toEqual({ instructor: '蕭淑芬', slots: ['2 14:10-16:00 '] });
    expect(s['英文（二）']).toEqual({ instructor: '李金安', slots: ['5 08:10-10:00 SG314'] }); // display name keeps full-width brackets
    expect(r.courses.find((x) => x.name === '投資學')?.group).toBe('國企系經管二');
  });

  it('maps night periods 13–14, and ignores empty / repeated cells', () => {
    const r = cellsToCourses([
      c(1, 13, '', '夜間課', 'X', 'B 101'),
      c(1, 14, '', '夜間課', 'X', 'B 101'),
      c(1, 1, '', '   ', 'X', ''),
      c(9, 1, '', '錯誤星期', 'X', ''),
      c(2, 1, '', '微積分', 'A', 'H 112'),
      c(2, 1, '', '微積分', 'A', 'H 112'),
    ]);
    expect(r.skipped).toEqual([]);
    expect(summary(r)).toEqual({
      夜間課: { instructor: 'X', slots: ['1 20:10-22:00 B101'] },
      微積分: { instructor: 'A', slots: ['2 08:10-09:00 H112'] },
    });
  });

  it('treats width and spacing variants of the same name as one course', () => {
    const r = cellsToCourses([c(1, 1, '', '英文（二）', 'A', 'B 1'), c(2, 1, '', '英文 (二)', 'A', 'B 1')]);
    expect(r.courses).toHaveLength(1);
    expect(r.courses[0]!.name).toBe('英文（二）');
  });

  it('preserves TA labels instead of dropping them', () => {
    expect(cellsToCourses([c(1, 1, '', '實習', '助　教', 'B 1')]).courses[0]).toMatchObject({ name: '實習（助教）', instructor: '助教' });
  });

  it('does not merge different named teachers or unknown teachers into one lecturer', () => {
    const result = cellsToCourses([c(1, 1, '', '專題', '老師甲', 'B1'), c(1, 2, '', '專題', '老師乙', 'B1'), c(1, 3, '', '專題', '', 'B1')]);
    expect(result.courses).toHaveLength(3);
    expect(result.courses.map((course) => course.instructor)).toEqual(['老師甲', '老師乙', '']);
  });
});

describe('normalizeRoom', () => {
  it('removes spaces and folds full-width characters', () => {
    expect(normalizeRoom('SG 314')).toBe('SG314');
    expect(normalizeRoom('ｂ　２１７')).toBe('B217');
  });
});

describe('roomWithBuilding (在哪裡上課)', () => {
  it('names the building for 淡江 room codes and leaves unknown codes alone', async () => {
    const { roomWithBuilding } = await import('@/data/places');
    expect(roomWithBuilding('B217')).toBe('B217 · 商管大樓');
    expect(roomWithBuilding('SG314')).toBe('SG314 · 紹謨紀念體育館');
    expect(roomWithBuilding('FL105')).toBe('FL105 · 外國語文大樓');
    expect(roomWithBuilding('T310')).toBe('T310 · 驚聲紀念大樓');
    expect(roomWithBuilding('線上')).toBe('線上');
    expect(roomWithBuilding('')).toBe('');
  });
});
