/**
 * 已查核存在的官方公開資源（2026-10-12 經搜尋確認網址存在；tku-sso、tku-sis 於 2026-10-14 開啟頁面確認）。
 * 校務行政／學務系統只提供官方連結，App 不代登入、不要求或保存校務系統帳密。
 * 內容本身尚未擷取進知識庫；校園助理只會引用標題與連結，不會編造內文。
 */
export interface OfficialSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** 文件標示的修訂/發布日期（若有） */
  updated?: string;
  keywords: string[];
  /** English keywords (matched case-insensitively) */
  keywordsEn: string[];
  /** English description of the document, for the English UI (the official title stays Chinese) */
  titleEn: string;
  kind: 'regulation' | 'handbook' | 'service' | 'news' | 'reference';
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: 'leave-rules',
    title: '淡江大學學生請假規則',
    publisher: '淡江大學學生事務處',
    url: 'https://sa.tku.edu.tw/spirit/uploads//2024/12/6-23淡江大學學生請假規則113.12.30.doc',
    updated: '民國 113 年 12 月 30 日修正',
    keywords: ['請假', '病假', '事假', '公假', '喪假', '缺曠', '曠課'],
    keywordsEn: ['leave', 'sick', 'absence', 'absent', 'skip class'],
    titleEn: 'Student leave regulations',
    kind: 'regulation',
  },
  {
    id: 'handbook-114',
    title: '114 學年度學生手冊',
    publisher: '淡江大學學生事務處',
    url: 'https://sa.tku.edu.tw/spirit/uploads//2025/09/114學年度學生手冊.pdf',
    updated: '2025 年 9 月上傳',
    keywords: ['校規', '學生手冊', '獎懲', '宿舍', '獎學金', '規則', '法規'],
    keywordsEn: ['rule', 'regulation', 'handbook', 'dorm', 'scholarship', 'discipline'],
    titleEn: 'Student handbook 2025–26 (AY114)',
    kind: 'handbook',
  },
  {
    id: 'periods',
    title: '上課節次時間（德文系 113-1 課程表）',
    publisher: '淡江大學德國語文學系',
    url: 'https://www.tfgx.tku.edu.tw/tfgx/wp-content/uploads/2024/09/113-1.pdf',
    keywords: ['節次', '第幾節', '上課時間', '下課'],
    keywordsEn: ['class periods', 'period times'],
    titleEn: 'Class period times',
    kind: 'reference',
  },
  {
    id: 'deds-room',
    title: '教室設備及借用',
    publisher: '淡江大學遠距教學發展中心',
    url: 'https://deds.tku.edu.tw/room/',
    keywords: ['教室設備', '借用器材', '多媒體', '投影'],
    keywordsEn: ['equipment', 'projector', 'borrow equipment'],
    titleEn: 'Classroom equipment & lending',
    kind: 'service',
  },
  {
    id: 'space-rental',
    title: '場地借用資訊網',
    publisher: '淡江大學',
    url: 'https://spacerental.tku.edu.tw/spacelisting.aspx?t=m',
    keywords: ['借場地', '場地借用', '會議室', '活動場地'],
    keywordsEn: ['venue', 'book a room', 'room booking', 'meeting room'],
    titleEn: 'Venue booking',
    kind: 'service',
  },
  {
    id: 'tkutimes',
    title: '淡江時報',
    publisher: '淡江大學',
    url: 'https://tkutimes.tku.edu.tw/',
    keywords: ['新聞', '校園新聞', '時報'],
    keywordsEn: ['news'],
    titleEn: 'Tamkang Times (campus news)',
    kind: 'news',
  },
  {
    id: 'tku-home',
    title: '淡江大學官方網站',
    publisher: '淡江大學',
    url: 'https://www.tku.edu.tw/',
    keywords: ['官網', '公告', '行政', '行事曆'],
    keywordsEn: ['website', 'announcement', 'calendar', 'admin'],
    titleEn: 'Tamkang University website',
    kind: 'reference',
  },
  {
    id: 'library',
    title: '淡江大學圖書館',
    publisher: '淡江大學覺生紀念圖書館',
    url: 'https://www.lib.tku.edu.tw/',
    keywords: ['圖書館', '借書', '自習', '館藏'],
    keywordsEn: ['library', 'borrow books', 'study space'],
    titleEn: 'Tamkang University Library',
    kind: 'service',
  },
  {
    id: 'tku-sso',
    title: '校務行政系統',
    publisher: '單一登入 · 淡江大學資訊處',
    url: 'https://sso.tku.edu.tw/NEAI/loginrwd.jsp?myurl=',
    keywords: ['校務行政', '行政系統', '單一登入', 'SSO', '學號登入', '校務系統'],
    keywordsEn: ['admin system', 'single sign-on', 'sso', 'student portal'],
    titleEn: 'University admin systems (single sign-on)',
    kind: 'service',
  },
  {
    id: 'tku-sis',
    title: '學務系統',
    publisher: '淡江大學',
    url: 'https://www.sis.tku.edu.tw/',
    keywords: ['學務系統', '請假系統', '獎學金', '助學金', '社團', '學雜費減免', '操行'],
    keywordsEn: ['student affairs system', 'leave request', 'scholarship', 'clubs', 'tuition reduction'],
    titleEn: 'Student Affairs System (leave, scholarships, clubs)',
    kind: 'service',
  },
  {
    id: 'academic-calendar',
    title: '淡江大學 115 學年度行事曆',
    publisher: '淡江大學教務處',
    url: 'https://www.acad.tku.edu.tw/get_page?t=rtdoc&rtdoc_id=OAA201&lang=tw',
    updated: '2026-10-28 查核（PDF SHA-256 600f753a…）',
    keywords: ['行事曆', '校曆', '期中考', '期中', '期末考', '期末', '段考', '評量週', '放假', '開學'],
    keywordsEn: ['academic calendar', 'midterm', 'final exam', 'exam week', 'holiday', 'semester start'],
    titleEn: 'Academic calendar, academic year 115 (exam periods, holidays)',
    kind: 'reference',
  },
];

export const QUICK_SERVICES = ['tku-sso', 'tku-sis', 'tku-home', 'library', 'handbook-114', 'leave-rules', 'space-rental', 'tkutimes']
  .map((id) => OFFICIAL_SOURCES.find((s) => s.id === id)!)
  .filter(Boolean);
