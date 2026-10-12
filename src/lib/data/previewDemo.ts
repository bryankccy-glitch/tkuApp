/**
 * Preview builds only (VITE_PREVIEW_DEMO=1): seeds clearly-labelled example data
 * into 本機模式 storage the first time, so the hosted preview opens in a working state.
 * Never used in production builds.
 */
const KEY = 'tku.local.v1';

export function seedPreviewDemo() {
  try {
    if (localStorage.getItem(KEY)) return;
    const now = new Date();
    const wd = now.getDay() === 0 ? 7 : now.getDay();
    const next = (n: number) => ((wd - 1 + n) % 7) + 1;
    const at = (days: number, h: number, m: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    const ay = (mo >= 8 ? y : y - 1) - 1911;
    const term = mo >= 8 || mo === 1 ? 1 : 2;
    const sem = { id: 'demo-sem', code: `${ay}-${term}`, name: `${ay} 學年度第 ${term} 學期`, startDate: `${ay + 1911}-08-01`, endDate: `${ay + 1912}-01-31` };
    const c = (id: string, name: string, instructor: string, color: string, slots: [number, string, string, string][]) => ({
      id, semesterId: sem.id, name, instructor, color, notes: '範例課程', createdAt: now.toISOString(), updatedAt: now.toISOString(),
      slots: slots.map(([weekday, startTime, endTime, room], i) => ({ id: `${id}-${i}`, weekday, startTime, endTime, room })),
    });
    const t = (id: string, title: string, kind: string, courseId: string | null, dueAt: string, priority: string, completed = false) => ({
      id, title, kind, courseId, dueAt, priority, completed, completedAt: completed ? now.toISOString() : null, remindMinutesBefore: 1440,
      description: '範例待辦', createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
    const store = {
      profile: { id: 'local', displayName: '範例同學' },
      semesters: [sem],
      courses: [
        c('demo-ds', '資料結構（範例）', '範例教師', 'blue', [[wd, '10:10', '12:00', 'E304'], [next(2), '08:10', '09:00', 'E304']]),
        c('demo-en', '英文（一）（範例）', '範例教師', 'heritage', [[wd, '13:10', '15:00', 'FL105']]),
        c('demo-calc', '微積分（範例）', '範例教師', 'teal', [[wd, '15:10', '17:00', 'S101'], [next(1), '10:10', '12:00', 'H112']]),
        c('demo-hist', '淡江校史（範例）', '範例教師', 'amber', [[next(1), '13:10', '15:00', 'L204']]),
      ],
      tasks: [
        t('demo-t1', '第三章習題', 'homework', 'demo-ds', at(1, 23, 59), 'medium'),
        t('demo-t2', '期中考', 'midterm', 'demo-calc', at(5, 10, 10), 'high'),
        t('demo-t3', '英文作文初稿', 'report', 'demo-en', at(0, 21, 0), 'high', true),
        t('demo-t4', '社團迎新海報', 'personal', null, at(3, 18, 0), 'low'),
      ],
    };
    localStorage.setItem(KEY, JSON.stringify(store));
    localStorage.setItem('tku.semester', sem.id);
  } catch {
    /* storage unavailable: app still works with empty data */
  }
}
