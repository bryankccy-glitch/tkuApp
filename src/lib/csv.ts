import { COURSE_COLORS, type Course, type CourseColor, type Weekday } from './types';
import { validateSlot } from './schedule';

/**
 * CSV 欄位（第一列為標題）：
 * 課程名稱,課號,教授,星期,開始,結束,教室,顏色,備註
 * 星期使用 1–7（1=週一）或「一、二…日」。同一課程多個時段請分多列，課程名稱相同即合併。
 */
export const CSV_HEADER = ['課程名稱', '課號', '教授', '星期', '開始', '結束', '教室', '顏色', '備註'] as const;

const ZH_DAYS: Record<string, Weekday> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };

function escapeCell(v: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function coursesToCsv(courses: Course[]): string {
  const rows: string[][] = [[...CSV_HEADER]];
  for (const c of courses) {
    for (const s of c.slots) {
      rows.push([c.name, c.code ?? '', c.instructor ?? '', String(s.weekday), s.startTime, s.endTime, s.room, c.color, c.notes ?? '']);
    }
  }
  return '\uFEFF' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

/** RFC4180-ish parser supporting quotes, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface ImportedCourse {
  name: string;
  code?: string;
  instructor?: string;
  color: CourseColor;
  notes?: string;
  slots: { weekday: Weekday; startTime: string; endTime: string; room: string }[];
}

export interface ImportResult {
  courses: ImportedCourse[];
  errors: { line: number; message: string }[];
}

function normTime(v: string): string {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : v.trim();
}

export function csvToCourses(text: string): ImportResult {
  const rows = parseCsv(text);
  const errors: ImportResult['errors'] = [];
  const map = new Map<string, ImportedCourse>();
  if (rows.length === 0) return { courses: [], errors: [{ line: 1, message: '檔案是空的' }] };
  const header = rows[0]!.map((h) => h.trim());
  const start = header[0] === CSV_HEADER[0] ? 1 : 0;
  rows.slice(start).forEach((r, idx) => {
    const line = idx + start + 1;
    const [name = '', code = '', instructor = '', day = '', st = '', et = '', room = '', color = '', notes = ''] = r.map((c) =>
      c.trim().replace(/^'(?=[=+\-@])/, ''),
    );
    if (!name) return errors.push({ line, message: '缺少課程名稱' });
    if (name.length > 80) return errors.push({ line, message: '課程名稱過長（上限 80 字）' });
    const weekday = (/^[1-7]$/.test(day) ? Number(day) : ZH_DAYS[day.replace(/^(週|星期)/, '')]) as Weekday | undefined;
    if (!weekday) return errors.push({ line, message: `無法辨識星期「${day}」` });
    const slot = { weekday, startTime: normTime(st), endTime: normTime(et), room: room.slice(0, 20) };
    const err = validateSlot(slot);
    if (err) return errors.push({ line, message: err });
    const existing = map.get(name);
    if (existing) existing.slots.push(slot);
    else
      map.set(name, {
        name,
        code: code || undefined,
        instructor: instructor || undefined,
        color: (COURSE_COLORS as readonly string[]).includes(color) ? (color as CourseColor) : 'navy',
        notes: notes || undefined,
        slots: [slot],
      });
    return undefined;
  });
  return { courses: [...map.values()], errors };
}
