import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { buildingFromRoom } from '../src/data/places.js';
import { loadEntries, taipeiClock, type EntryRow } from './widget.js';

/**
 * GET /api/push-reminders — called every minute by Supabase pg_cron (migration 20261020120000).
 * Sends Web Push notifications for class starts and task deadlines to every stored subscription,
 * so reminders arrive even when the app is closed. Each reminder is recorded in push_sent once.
 * Auth: "Authorization: Bearer $CRON_SECRET". Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 */

const KIND: Record<string, string> = { homework: '作業', report: '報告', quiz: '小考', midterm: '期中考', final: '期末考', personal: '待辦' };
/** How late a reminder may still go out (cron hiccups, cold starts). */
export const GRACE_MS = 4 * 60_000;

export interface Sub { endpoint: string; user_id: string; p256dh: string; auth: string; class_minutes: number; tasks: boolean }
export interface TaskRow { id: string; title: string; kind: string; due_at: string; remind_minutes_before: number | null }
export interface PushMessage { id: string; title: string; body: string; url: string }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hm = (t: string) => t.slice(0, 5);

/** Classes whose reminder time (start − minutes) falls in (now − GRACE, now], Taipei time. */
export function dueClassReminders(entries: EntryRow[], classMinutes: number, now: Date): PushMessage[] {
  if (classMinutes <= 0) return [];
  const { weekday, minutes, date } = taipeiClock(now);
  const nowMin = minutes + now.getUTCSeconds() / 60;
  const out: PushMessage[] = [];
  const seen = new Set<string>();
  for (const e of entries.filter((x) => x.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const at = toMin(e.start_time) - classMinutes;
    if (!(at <= nowMin && nowMin - at < GRACE_MS / 60_000)) continue;
    const key = `${e.name}|${e.start_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Back-to-back periods: no reminder for a period that directly continues the same course.
    const prev = entries.find((p) => p.weekday === weekday && p.name === e.name && toMin(e.start_time) - toMin(p.end_time) >= 0 && toMin(e.start_time) - toMin(p.end_time) <= 15);
    if (prev) continue;
    const b = e.room ? buildingFromRoom(e.room) : undefined;
    out.push({
      id: `class:${date}:${hm(e.start_time)}:${e.name}`,
      title: `${classMinutes} 分鐘後上課：${e.name}`,
      body: [e.room && `${e.room}${b ? `（${b.name}）` : ''}`, `${hm(e.start_time)}–${hm(e.end_time)}`].filter(Boolean).join('　'),
      url: '/schedule',
    });
  }
  return out;
}

export function dueTaskReminders(tasks: TaskRow[], now: Date): PushMessage[] {
  const out: PushMessage[] = [];
  for (const t of tasks) {
    if (t.remind_minutes_before === null) continue;
    const due = Date.parse(t.due_at);
    const at = due - t.remind_minutes_before * 60_000;
    if (!(at <= now.getTime() && now.getTime() - at < GRACE_MS)) continue;
    const time = new Date(due).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });
    out.push({ id: `task:${t.id}:${t.due_at}:${t.remind_minutes_before}`, title: `${KIND[t.kind] ?? '待辦'}即將截止：${t.title}`, body: `截止時間 ${time}`, url: '/tasks' });
  }
  return out;
}

interface FriendRow { id: string; requester: string; addressee: string; status: string; created_at: string; updated_at: string }

/** New friend requests to this user, and requests of theirs that were just accepted. */
export function dueFriendNotices(rows: FriendRow[], names: Map<string, string>, userId: string, now: Date): PushMessage[] {
  const recent = (iso: string) => now.getTime() - Date.parse(iso) < 10 * 60_000;
  const out: PushMessage[] = [];
  for (const f of rows) {
    if (f.status === 'pending' && f.addressee === userId && recent(f.created_at)) {
      out.push({ id: `friend:req:${f.id}`, title: '新的好友邀請', body: `${names.get(f.requester) ?? '一位同學'} 想加你為好友，點這裡查看`, url: '/schedule' });
    } else if (f.status === 'accepted' && f.requester === userId && recent(f.updated_at)) {
      out.push({ id: `friend:acc:${f.id}`, title: '好友邀請已接受', body: `${names.get(f.addressee) ?? '對方'} 接受了你的好友邀請，現在可以互看課表`, url: '/schedule' });
    }
  }
  return out;
}

export interface RunResult { users: number; sent: number; failed: number; removed: number }

export async function runPushReminders(db: SupabaseClient, send: (sub: Sub, msg: PushMessage) => Promise<void>, now = new Date()): Promise<RunResult> {
  const { data, error } = await db.from('push_subscriptions').select('endpoint,user_id,p256dh,auth,class_minutes,tasks');
  if (error) throw new Error(error.message);
  const subs = (data ?? []) as Sub[];
  const byUser = new Map<string, Sub[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const result: RunResult = { users: byUser.size, sent: 0, failed: 0, removed: 0 };
  const { date } = taipeiClock(now);

  for (const [userId, userSubs] of byUser) {
    const classMinutes = Math.max(...userSubs.map((s) => s.class_minutes));
    const wantTasks = userSubs.some((s) => s.tasks);
    const msgs: PushMessage[] = [];
    if (classMinutes > 0) msgs.push(...dueClassReminders(await loadEntries(db, userId, date, true), classMinutes, now));
    if (wantTasks) {
      const { data: tasks, error: tErr } = await db.from('tasks').select('id,title,kind,due_at,remind_minutes_before')
        .eq('user_id', userId).eq('completed', false).not('remind_minutes_before', 'is', null)
        .gte('due_at', now.toISOString()).lte('due_at', new Date(now.getTime() + 15 * 86_400_000).toISOString());
      if (tErr) throw new Error(tErr.message);
      msgs.push(...dueTaskReminders((tasks ?? []) as TaskRow[], now));
    }
    {
      const since = new Date(now.getTime() - 10 * 60_000).toISOString();
      const { data: fr, error: fErr } = await db.from('friendships').select('id,requester,addressee,status,created_at,updated_at')
        .or(`addressee.eq.${userId},requester.eq.${userId}`).gte('updated_at', since);
      if (fErr) throw new Error(fErr.message);
      const rows = (fr ?? []) as FriendRow[];
      if (rows.length) {
        const others = [...new Set(rows.map((r) => (r.requester === userId ? r.addressee : r.requester)))];
        const { data: profs } = await db.from('profiles').select('id,display_name').in('id', others);
        const names = new Map(((profs ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
        msgs.push(...dueFriendNotices(rows, names, userId, now));
      }
    }
    for (const msg of msgs) {
      // Claim first: a concurrent or repeated run can't send the same reminder twice.
      const { error: claimErr } = await db.from('push_sent').insert({ user_id: userId, reminder_id: msg.id });
      if (claimErr) continue; // already sent (primary key) or table error — skip
      for (const sub of userSubs) {
        try {
          await send(sub, msg);
          result.sent += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            result.removed += 1;
          } else {
            result.failed += 1;
          }
        }
      }
    }
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(secret ? 401 : 503).json({ error: secret ? 'unauthorized' : 'CRON_SECRET not configured' });
    return;
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const vapidPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!url || !key || !vapidPublic || !vapidPrivate) {
    res.status(503).json({ error: 'push not configured' });
    return;
  }
  webpush.setVapidDetails('https://tku-app.vercel.app/about', vapidPublic, vapidPrivate);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const result = await runPushReminders(db, async (sub, msg) => {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: msg.title, body: msg.body, tag: msg.id, url: msg.url }),
        { TTL: 600, urgency: 'high' },
      );
    });
    if (result.sent || result.failed || result.removed) console.log('push-reminders', JSON.stringify(result));
    res.status(200).json(result);
  } catch (e) {
    console.error('push-reminders failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'failed' });
  }
}
