import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/sync-events — daily Vercel Cron (vercel.json "crons").
 * Pulls the official TKU activity sign-up list (https://enroll.tku.edu.tw/), opens each candidate's
 * page for exact time/place, and keeps public.campus_events in step:
 *  - new eligible activities are inserted (published),
 *  - existing ones get time/place refreshed (their hand-written summary is kept),
 *  - ones that became 額滿 or vanished from the list are archived.
 * Eligible = open to students, not full, starts within the coming ~10 weeks, lasts ≤ 14 days,
 * and isn't an admissions/alumni event. Summaries are built from the fields, never copied text.
 * Auth: Vercel sends "Authorization: Bearer $CRON_SECRET"; without CRON_SECRET set it refuses.
 */

export const ORIGIN = 'https://enroll.tku.edu.tw';
export const SOURCE_NAME = '淡江大學活動報名系統';
const UA = 'TKU-Campus-OS/1.0 (student project; daily sync of public activity list)';

export interface ListItem { cid: string; title: string; audience: string; organizer: string; full: boolean }
export interface Detail { start: string; end: string | null; regEnd: string | null; location: string | null; audience: string | null }
export type Category = 'campus' | 'club' | 'lecture' | 'hackathon' | 'programming' | 'internship' | 'scholarship' | 'research' | 'industry';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/** HTML → text with line breaks at block boundaries. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h\d|li|tr|td|th|span|dd|dt|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const clean = (s: string) => htmlToText(s).replace(/\n+/g, ' ').trim();

/** Rows of the list page that link to an activity (course.aspx?cid=…). */
export function parseList(html: string): ListItem[] {
  const out = new Map<string, ListItem>();
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const link = row.match(/course\.aspx\?cid=([^"'&\s>]+)[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const cid = decodeEntities(link[1]!);
    const title = clean(link[2]!);
    const cells = row.split(/<td[\s>]/i).slice(1).map((c) => clean(c.replace(/<\/td>[\s\S]*$/i, '')));
    // Columns: 序號 | 活動起迄日 | 活動名稱 | 對象 | 報名起迄日 | 承辦單位 | 我要報名
    const titleIdx = cells.findIndex((c) => c.includes(title.slice(0, 8)));
    const audience = titleIdx >= 0 ? cells[titleIdx + 1] ?? '' : '';
    const organizer = titleIdx >= 0 ? cells[titleIdx + 3] ?? '' : '';
    const full = /額滿/.test(clean(row));
    if (title && !out.has(cid)) out.set(cid, { cid, title: title.replace(/^\(已額滿\)\s*/, ''), audience, organizer, full });
  }
  return [...out.values()];
}

/** Page count from the pager ("index.aspx?pg=N"). */
export function parsePageCount(html: string): number {
  const pages = [...html.matchAll(/[?&]pg=(\d+)/g)].map((m) => Number(m[1]));
  return Math.min(10, Math.max(1, ...pages));
}

const DT = String.raw`(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d{1,2}):(\d{2})`;
function iso(m: RegExpMatchArray, o: number): string {
  const p = (i: number) => m[o + i]!.padStart(2, '0');
  return `${m[o]}-${p(1)}-${p(2)}T${p(3)}:${p(4)}:00+08:00`;
}

/** Fields from an activity page (labels as on the site: 活動時間：/報名時間：/活動地點：/活動對象：). */
export function parseDetail(html: string): Detail | null {
  const text = htmlToText(html);
  const when = text.match(new RegExp(String.raw`活動時間[：:]\s*${DT}\s*[~～-]\s*${DT}`));
  if (!when) return null;
  const reg = text.match(new RegExp(String.raw`報名時間[：:]\s*${DT}\s*[~～-]\s*${DT}`));
  const place = text.match(/活動地點[：:]\s*([^\n]{1,80})/);
  const who = text.match(/活動對象[：:]\s*([^\n]{1,80})/);
  return {
    start: iso(when, 1),
    end: iso(when, 6),
    regEnd: reg ? iso(reg, 6) : null,
    location: place?.[1]?.trim() || null,
    audience: who?.[1]?.trim() || null,
  };
}

export function categorize(title: string, organizer: string): Category {
  const s = `${title} ${organizer}`;
  if (/黑客松|hackathon/i.test(s)) return 'hackathon';
  if (/獎學金|助學金/.test(s)) return 'scholarship';
  if (/實習/.test(s)) return 'internship';
  if (/國科會|研究計畫|研討會/.test(s)) return 'research';
  if (/AI|程式|Python|GitHub|Azure|Copilot|ChatGPT|Gemini|自動化|資料庫|coding|雲端/i.test(s)) return 'programming';
  if (/職涯|證照|認證|MOS|求職|履歷|面試|產業|業界/.test(s)) return 'industry';
  if (/社團|社$|社[／/×]|課外活動/.test(s)) return 'club';
  if (/講座|演講|論壇|座談|說明會|分享會/.test(s)) return 'lecture';
  return 'campus';
}

const DAY = 86_400_000;
export function isEligible(item: ListItem, d: Detail, now: Date): boolean {
  if (item.full) return false;
  const who = `${item.audience} ${d.audience ?? ''}`;
  if (!/學生|不限|全校|所有|師生/.test(who)) return false;
  if (/招生|系友|校友回娘家|教師社群|觀課|教學實踐|報帳/.test(item.title)) return false;
  const start = Date.parse(d.start);
  const end = d.end ? Date.parse(d.end) : start;
  if (!Number.isFinite(start) || end < now.getTime() || start > now.getTime() + 70 * DAY) return false;
  if (end - start > 14 * DAY) return false;
  return true;
}

export function buildSummary(item: ListItem, d: Detail): string {
  const parts = [`主辦：${item.organizer || '淡江大學'}`];
  const who = d.audience || item.audience;
  if (who) parts.push(`對象：${who}`);
  if (d.regEnd) {
    const r = d.regEnd.slice(5, 16).replace('-', '/').replace('T', ' ');
    parts.push(`報名至 ${r}`);
  }
  return `${parts.join('｜')}。詳細內容與報名請見活動頁。`.slice(0, 300);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1]?.toLowerCase() ?? 'utf-8';
  return new TextDecoder(charset === 'big5' ? 'big5' : 'utf-8').decode(buf);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }));
  return out;
}

export interface SyncResult { listed: number; eligible: number; inserted: number; updated: number; archived: number; skippedDetails: number }

export async function syncEvents(db: SupabaseClient, now = new Date(), get: (url: string) => Promise<string> = fetchText): Promise<SyncResult> {
  const first = await get(`${ORIGIN}/`);
  const items = parseList(first);
  const pages = parsePageCount(first);
  for (let pg = 2; pg <= pages; pg += 1) items.push(...parseList(await get(`${ORIGIN}/index.aspx?pg=${pg}`)));
  // A broken/changed page must not wipe the table.
  if (items.length < 10) throw new Error(`list looks wrong (${items.length} rows)`);

  const candidates = items.filter((it) => !it.full && /學生|不限|全校|所有|師生/.test(it.audience || '學生'));
  let skippedDetails = 0;
  const details = await mapLimit(candidates, 6, async (it) => {
    try { return parseDetail(await get(`${ORIGIN}/course.aspx?cid=${encodeURIComponent(it.cid)}`)); }
    catch { skippedDetails += 1; return null; }
  });

  const url = (cid: string) => `${ORIGIN}/course.aspx?cid=${cid}`;
  const eligible = candidates
    .map((it, i) => ({ it, d: details[i] }))
    .filter((x): x is { it: ListItem; d: Detail } => Boolean(x.d) && isEligible(x.it, x.d!, now));

  const { data: existingRows, error: exErr } = await db.from('campus_events').select('id,source_url,status').eq('source_name', SOURCE_NAME);
  if (exErr) throw new Error(exErr.message);
  const existing = new Map((existingRows ?? []).map((r: { id: string; source_url: string; status: string }) => [r.source_url, r]));

  let inserted = 0;
  let updated = 0;
  const keep = new Set<string>();
  for (const { it, d } of eligible) {
    const src = url(it.cid);
    keep.add(src);
    const fields = { starts_at: d.start, ends_at: d.end, location: d.location, status: 'published' };
    const row = existing.get(src);
    if (row) {
      const { error } = await db.from('campus_events').update(fields).eq('id', row.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { error } = await db.from('campus_events').insert({
        ...fields,
        title: it.title.slice(0, 120),
        category: categorize(it.title, it.organizer),
        summary: buildSummary(it, d),
        organizer: (it.organizer || '淡江大學').slice(0, 80),
        source_name: SOURCE_NAME,
        source_url: src,
        registration_url: src,
        published_at: now.toISOString(),
      });
      if (error) throw new Error(error.message);
      inserted += 1;
    }
  }

  // Upcoming published rows from this source that are no longer eligible (full, removed, closed to students).
  // Rows whose detail page failed to load this run are left alone.
  const failed = new Set(candidates.filter((_, i) => !details[i]).map((it) => url(it.cid)));
  const toArchive = [...existing.values()].filter((r) => r.status === 'published' && !keep.has(r.source_url) && !failed.has(r.source_url));
  if (toArchive.length) {
    const { error } = await db.from('campus_events').update({ status: 'archived' })
      .in('id', toArchive.map((r) => r.id)).gte('starts_at', now.toISOString());
    if (error) throw new Error(error.message);
  }
  return { listed: items.length, eligible: eligible.length, inserted, updated, archived: toArchive.length, skippedDetails };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !key) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  const db = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const result = await syncEvents(db);
    console.log('sync-events', JSON.stringify(result));
    res.status(200).json(result);
  } catch (e) {
    console.error('sync-events failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'sync failed' });
  }
}
