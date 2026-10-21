import { describe, expect, it } from 'vitest';
import { buildSummary, categorize, isEligible, parseDetail, parseList, parsePageCount, syncEvents, ORIGIN, SOURCE_NAME, type Detail, type ListItem } from '../sync-events.js';

// Synthetic fixtures shaped like enroll.tku.edu.tw (table: 序號|活動起迄日|活動名稱|對象|報名起迄日|承辦單位|我要報名).
const row = (n: number, cid: string, title: string, who: string, org: string, extra = '') => `
  <tr class="row"><td>${n}</td><td>2026-10-24</td>
  <td><a href="course.aspx?cid=${cid}">${title}</a>${extra}</td><td>${who}</td>
  <td>2026-10-16~2026-10-23</td><td>${org}</td><td><a href="signup.aspx?m=local&amp;cid=${cid}">校內報名</a></td></tr>`;

const LIST = `<table><tr><th>序號</th><th>活動起迄日</th><th>活動名稱</th></tr>
${row(1, 'ASBX1024AI', '社團AI與資訊推廣活動-遊戲開發者座談會', '學生', '課外活動輔導組')}
${row(2, 'FULL1', '(已額滿)職涯規劃講座', '學生', '諮商職涯暨學習發展輔導中心', '<span>額滿</span>')}
${row(3, 'STAFF1', '產學合作報帳說明會', '教師、職員', '會計組')}
</table><div class="pager">首頁 上頁 1 <a href="index.aspx?pg=2">2</a> <a href="index.aspx?pg=2">末頁</a></div>`;

const detailHtml = (start: string, end: string, place = '商管大樓B712教室', who = '學生') => `
  <h3>活動時間：</h3><p>${start} ~ ${end}</p>
  <h3>報名時間：</h3><p>2026/10/16 08:00 ~ 2026/10/23 12:00</p>
  <h3>活動地點：</h3><p>${place}</p>
  <div>活動時數：4.0 小時<br>報名人次上限：70 名<br>活動對象：${who}</div>`;

describe('sync-events parsing', () => {
  it('reads list rows, audience, organizer and the 額滿 flag', () => {
    const items = parseList(LIST);
    expect(items.map((i) => i.cid)).toEqual(['ASBX1024AI', 'FULL1', 'STAFF1']);
    expect(items[0]).toMatchObject({ title: '社團AI與資訊推廣活動-遊戲開發者座談會', audience: '學生', organizer: '課外活動輔導組', full: false });
    expect(items[1]).toMatchObject({ title: '職涯規劃講座', full: true });
    expect(parsePageCount(LIST)).toBe(2);
  });

  it('reads exact time, registration end and place from an activity page', () => {
    expect(parseDetail(detailHtml('2026/10/24 13:00', '2026/10/24 17:00'))).toEqual({
      start: '2026-10-24T13:00:00+08:00', end: '2026-10-24T17:00:00+08:00', regEnd: '2026-10-23T12:00:00+08:00',
      location: '商管大樓B712教室', audience: '學生',
    });
    expect(parseDetail('<p>no fields</p>')).toBeNull();
  });

  it('keeps only upcoming, short, student activities and writes its own summary', () => {
    const now = new Date('2026-10-19T00:00:00+08:00');
    const it: ListItem = { cid: 'x', title: '講座', audience: '學生', organizer: '外交系', full: false };
    const d = (s: string, e: string): Detail => ({ start: s, end: e, regEnd: '2026-10-23T12:00:00+08:00', location: 'E415', audience: '學生' });
    expect(isEligible(it, d('2026-10-24T13:00:00+08:00', '2026-10-24T17:00:00+08:00'), now)).toBe(true);
    expect(isEligible(it, d('2026-10-01T13:00:00+08:00', '2026-10-01T17:00:00+08:00'), now)).toBe(false); // past
    expect(isEligible(it, d('2026-09-30T00:00:00+08:00', '2026-12-31T00:00:00+08:00'), now)).toBe(false); // semester-long
    expect(isEligible({ ...it, audience: '教師、職員' }, { ...d('2026-10-24T13:00:00+08:00', '2026-10-24T17:00:00+08:00'), audience: '教師、職員' }, now)).toBe(false);
    expect(isEligible({ ...it, title: '碩專班招生說明會' }, d('2026-10-24T13:00:00+08:00', '2026-10-24T17:00:00+08:00'), now)).toBe(false);
    expect(buildSummary(it, d('2026-10-24T13:00:00+08:00', '2026-10-24T17:00:00+08:00'))).toBe('主辦：外交系｜對象：學生｜報名至 10/23 12:00。詳細內容與報名請見活動頁。');
    expect(categorize('【微學分】AI 實作體驗工作坊', 'AI創智學院')).toBe('programming');
    expect(categorize('國際微軟MOS認證研習', '諮商職涯')).toBe('industry');
  });
});

describe('syncEvents', () => {
  function fakeDb(existing: { id: string; source_url: string; status: string }[]) {
    const calls: { op: string; payload?: unknown; ids?: unknown }[] = [];
    const db = {
      from: () => ({
        select: () => ({ eq: async () => ({ data: existing, error: null }) }),
        insert: async (payload: unknown) => { calls.push({ op: 'insert', payload }); return { error: null }; },
        update: (payload: unknown) => ({
          eq: async (_c: string, id: unknown) => { calls.push({ op: 'update', payload, ids: id }); return { error: null }; },
          in: (_c: string, ids: unknown) => ({ gte: async () => { calls.push({ op: 'archive', payload, ids }); return { error: null }; } }),
        }),
      }),
    };
    return { db: db as never, calls };
  }

  const many = Array.from({ length: 10 }, (_, i) => row(10 + i, `OLD${i}`, `教師研習${i}`, '教師', '人資處')).join('');
  const pages: Record<string, string> = {
    [`${ORIGIN}/`]: LIST.replace('</table>', `${many}</table>`).replace(/index\.aspx\?pg=2/g, 'index.aspx?pg=1'),
    [`${ORIGIN}/course.aspx?cid=ASBX1024AI`]: detailHtml('2026/10/24 13:00', '2026/10/24 17:00'),
  };
  const get = async (u: string) => { const p = pages[u]; if (!p) throw new Error('404 ' + u); return p; };

  it('inserts new eligible activities and archives ones that became full', async () => {
    const { db, calls } = fakeDb([{ id: 'e1', source_url: `${ORIGIN}/course.aspx?cid=FULL1`, status: 'published' }]);
    const r = await syncEvents(db, new Date('2026-10-19T00:00:00+08:00'), get);
    expect(r).toMatchObject({ eligible: 1, inserted: 1, updated: 0, archived: 1 });
    const ins = calls.find((c) => c.op === 'insert')!.payload as Record<string, string>;
    expect(ins).toMatchObject({ source_name: SOURCE_NAME, status: 'published', location: '商管大樓B712教室', starts_at: '2026-10-24T13:00:00+08:00', category: 'programming' });
    expect(calls.find((c) => c.op === 'archive')!.ids).toEqual(['e1']);
  });

  it('refuses to touch the table when the list page looks broken', async () => {
    const { db, calls } = fakeDb([]);
    await expect(syncEvents(db, new Date(), async () => '<html>maintenance</html>')).rejects.toThrow(/list looks wrong/);
    expect(calls).toHaveLength(0);
  });
});
