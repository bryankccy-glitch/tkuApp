import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/widget  (Authorization: Bearer <widget token>)
 * Data for the iPhone home-screen widget (Scriptable): next class, today's classes, the nearest
 * open task and Tamsui weather. The token is the user's personal widget token created in 我的;
 * only its SHA-256 hash is stored (table widget_tokens). Read-only, no other data is returned.
 */

export const TZ = 'Asia/Taipei';
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=25.175&longitude=121.449&timezone=Asia%2FTaipei' +
  '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1';

export interface ClassSlot { name: string; start: string; end: string; room: string }
export interface WidgetPayload {
  generatedAt: string;
  weekday: number;
  next: (ClassSlot & { dayOffset: number; status: 'now' | 'next' }) | null;
  today: ClassSlot[];
  task: { title: string; kind: string; course: string | null; dueAt: string } | null;
  weather: { temperature: number; code: number; isDay: boolean; max: number; min: number } | null;
}

export interface EntryRow { weekday: number; start_time: string; end_time: string; room: string; name: string }

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Weekday (1 = Mon … 7 = Sun) and minutes since midnight in Taipei. */
export function taipeiClock(now: Date): { weekday: number; minutes: number; date: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[get('weekday')] ?? 1;
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')), date: `${get('year')}-${get('month')}-${get('day')}` };
}

const hm = (t: string) => t.slice(0, 5);
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Back-to-back periods of the same course in the same room read as one class on the widget. */
export function mergeSlots(rows: EntryRow[]): ClassSlot[] {
  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const out: ClassSlot[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.name === r.name && last.room === r.room && toMinutes(r.start_time) - toMinutes(last.end) <= 15) {
      last.end = hm(r.end_time);
    } else {
      out.push({ name: r.name, start: hm(r.start_time), end: hm(r.end_time), room: r.room });
    }
  }
  return out;
}

/** The class happening now, else the next one today, else the first one in the coming week. */
export function pickNext(rows: EntryRow[], weekday: number, minutes: number): WidgetPayload['next'] {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = ((weekday - 1 + offset) % 7) + 1;
    const slots = mergeSlots(rows.filter((r) => r.weekday === day));
    for (const s of slots) {
      if (offset === 0 && toMinutes(s.end) <= minutes) continue;
      const status = offset === 0 && toMinutes(s.start) <= minutes ? 'now' : 'next';
      return { ...s, dayOffset: offset, status };
    }
  }
  return null;
}

async function fetchWeather(): Promise<WidgetPayload['weather']> {
  try {
    const res = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
    };
    const c = j.current;
    if (typeof c?.temperature_2m !== 'number') return null;
    return {
      temperature: Math.round(c.temperature_2m),
      code: c.weather_code ?? 0,
      isDay: c.is_day === 1,
      max: Math.round(j.daily?.temperature_2m_max?.[0] ?? c.temperature_2m),
      min: Math.round(j.daily?.temperature_2m_min?.[0] ?? c.temperature_2m),
    };
  } catch {
    return null;
  }
}

type CourseRel = { name: string; semester_id: string } | { name: string; semester_id: string }[] | null;
const rel = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/** Entries of the semester in session today (or, between semesters, the most recent one). */
export async function loadEntries(db: SupabaseClient, userId: string, today: string, inSessionOnly = false): Promise<EntryRow[]> {
  const { data, error } = await db
    .from('schedule_entries')
    .select('weekday,start_time,end_time,room,user_courses!inner(name,semester_id)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { weekday: number; start_time: string; end_time: string; room: string; user_courses: CourseRel }[];
  const semIds = [...new Set(rows.map((r) => rel(r.user_courses)?.semester_id).filter((v): v is string => Boolean(v)))];
  if (!semIds.length) return [];
  const { data: sems, error: semErr } = await db.from('semesters').select('id,start_date,end_date').in('id', semIds);
  if (semErr) throw new Error(semErr.message);
  const list = (sems ?? []) as { id: string; start_date: string; end_date: string }[];
  const current = list.find((s) => s.start_date <= today && today <= s.end_date)
    ?? (inSessionOnly ? undefined : [...list].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]);
  if (!current) return [];
  return rows
    .filter((r) => rel(r.user_courses)?.semester_id === current?.id)
    .map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time, room: r.room, name: rel(r.user_courses)?.name ?? '' }));
}

async function loadTask(db: SupabaseClient, userId: string, now: Date): Promise<WidgetPayload['task']> {
  const { data, error } = await db
    .from('tasks')
    .select('title,kind,due_at,user_courses(name,user_id)')
    .eq('user_id', userId)
    .eq('completed', false)
    .gte('due_at', now.toISOString())
    .order('due_at')
    .limit(1);
  if (error) throw new Error(error.message);
  type Course = { name: string; user_id: string };
  const t = (data ?? [])[0] as { title: string; kind: string; due_at: string; user_courses: Course | Course[] | null } | undefined;
  if (!t) return null;
  // This client bypasses RLS, so a task pointing at someone else's course must not reveal its name.
  const course = rel(t.user_courses);
  return { title: t.title, kind: t.kind, course: course?.user_id === userId ? course.name : null, dueAt: t.due_at };
}

function bearer(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  return header.match(/^Bearer\s+([A-Za-z0-9_-]{20,200})$/i)?.[1] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const token = bearer(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: '缺少小工具密鑰' });
    return;
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    res.status(503).json({ error: '伺服器尚未設定' });
    return;
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const { data: row, error } = await db.from('widget_tokens').select('user_id').eq('token_hash', hashToken(token)).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      res.status(401).json({ error: '小工具密鑰無效或已停用，請在 App「我的」重新產生' });
      return;
    }
    const userId = (row as { user_id: string }).user_id;
    const now = new Date();
    const clock = taipeiClock(now);
    const [entries, task, weather] = await Promise.all([loadEntries(db, userId, clock.date), loadTask(db, userId, now), fetchWeather()]);
    await db.from('widget_tokens').update({ last_used_at: now.toISOString() }).eq('user_id', userId);
    const payload: WidgetPayload = {
      generatedAt: now.toISOString(),
      weekday: clock.weekday,
      next: pickNext(entries, clock.weekday, clock.minutes),
      today: mergeSlots(entries.filter((e) => e.weekday === clock.weekday)),
      task,
      weather,
    };
    res.status(200).json(payload);
  } catch {
    res.status(500).json({ error: '暫時無法讀取資料' });
  }
}
