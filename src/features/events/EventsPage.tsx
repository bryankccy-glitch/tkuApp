import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, CalendarPlus, ExternalLink, Search, Share2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, ErrorNotice, PageHeader } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useCampusEvents } from '@/lib/events';
import { EVENT_CATEGORIES, type CampusEvent, type EventCategory } from '@/lib/types';
import { EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatDateShort, formatTime } from '@/lib/time';
import { downloadIcs } from '@/lib/ics';
import { useBookmarks } from './useBookmarks';
import { LoadingMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

type Range = 'all' | 'week' | 'month' | 'saved';

export function filterEvents(events: CampusEvent[], opts: { q: string; cat: 'all' | EventCategory; range: Range; saved: string[]; now: Date }) {
  const q = opts.q.trim().toLowerCase();
  const n = opts.now.getTime();
  return events.filter((e) => {
    if (opts.cat !== 'all' && e.category !== opts.cat) return false;
    if (q && !`${e.title} ${e.summary} ${e.organizer}`.toLowerCase().includes(q)) return false;
    const t = new Date(e.startsAt).getTime();
    if (opts.range === 'week' && t > n + 7 * 86400_000) return false;
    if (opts.range === 'month' && t > n + 31 * 86400_000) return false;
    if (opts.range === 'saved' && !opts.saved.includes(e.id)) return false;
    return true;
  });
}

export default function EventsPage() {
  const { data, isLoading, error, refetch } = useCampusEvents();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | EventCategory>('all');
  const [range, setRange] = useState<Range>('all');
  const { ids: saved, toggle } = useBookmarks();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const list = useMemo(() => filterEvents(data ?? [], { q, cat, range, saved, now }), [data, q, cat, range, saved, now]);
  const open = (data ?? []).find((e) => e.id === params.get('id')) ?? null;

  const share = async (e: CampusEvent) => {
    const url = `${location.origin}/events?id=${e.id}`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, text: e.summary.slice(0, 80), url });
      else { await navigator.clipboard.writeText(url); toast({ tone: 'success', message: '已複製活動連結' }); }
    } catch { /* user cancelled */ }
  };

  return (
    <Page wide>
      <PageHeader title="活動與機會" subtitle="校園活動、講座、競賽、實習與獎學金。每則都附官方來源。" />

      {data === null ? (
        <EmptyState title="活動資料尚未連線" body="活動由管理後台維護，存放在雲端資料庫。設定 Supabase 後即可瀏覽；我們不會顯示來源不明的活動。" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="ev-q" className="sr-only">搜尋活動</label>
              <input id="ev-q" className="field pl-9" placeholder="搜尋活動名稱或主辦單位" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="sr-only" htmlFor="ev-cat">分類</label>
            <select id="ev-cat" className="field sm:w-36" value={cat} onChange={(e) => setCat(e.target.value as 'all' | EventCategory)}>
              <option value="all">全部分類</option>
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
            </select>
            <label className="sr-only" htmlFor="ev-range">日期</label>
            <select id="ev-range" className="field sm:w-32" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="all">所有日期</option>
              <option value="week">7 天內</option>
              <option value="month">30 天內</option>
              <option value="saved">已收藏</option>
            </select>
          </div>

          {isLoading ? <LoadingMark /> : error ? <div className="mt-4"><ErrorNotice error={error} onRetry={refetch} /></div> : list.length === 0 ? (
            <EmptyState title="沒有符合的活動" body="調整分類或日期範圍再試試。" />
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {list.map((e) => (
                <li key={e.id} className="flex flex-col rounded-sm border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-caption font-semibold text-heritage">{EVENT_CATEGORY_LABELS[e.category]}</p>
                    <button type="button" aria-pressed={saved.includes(e.id)} aria-label={saved.includes(e.id) ? '取消收藏' : '收藏活動'} onClick={() => toggle(e.id)} className="-m-1 rounded-xs p-1 text-muted hover:text-ink">
                      <Bookmark className={cn('h-5 w-5', saved.includes(e.id) && 'fill-heritage text-heritage')} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setParams({ id: e.id })} className="mt-1 text-left text-h3 text-ink hover:underline">{e.title}</button>
                  <p className="tabular mt-1 text-caption text-muted">{formatDateShort(new Date(e.startsAt))} {formatTime(new Date(e.startsAt))}{e.location ? `｜${e.location}` : ''}</p>
                  <p className="mt-2 line-clamp-2 text-caption text-muted">{e.summary}</p>
                  <p className="mt-auto pt-3 text-[11px] text-muted">來源：{e.sourceName}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={!!open} onClose={() => { params.delete('id'); setParams(params, { replace: true }); }} title={open?.title ?? ''} description={open ? `${EVENT_CATEGORY_LABELS[open.category]}｜${open.organizer}` : undefined}>
        {open && (
          <div className="grid gap-4">
            <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1.5 text-body">
              <dt className="text-muted">時間</dt>
              <dd className="tabular text-ink">{formatDateShort(new Date(open.startsAt))} {formatTime(new Date(open.startsAt))}{open.endsAt ? ` – ${formatTime(new Date(open.endsAt))}` : ''}</dd>
              {open.location && <><dt className="text-muted">地點</dt><dd className="text-ink">{open.location}</dd></>}
              <dt className="text-muted">來源</dt>
              <dd><a href={open.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-blue hover:underline">{open.sourceName}<ExternalLink className="h-3.5 w-3.5" /></a></dd>
              <dt className="text-muted">發布</dt>
              <dd className="text-ink">{formatDateShort(new Date(open.publishedAt))}</dd>
            </dl>
            <p className="whitespace-pre-wrap text-body text-ink">{open.summary}</p>
            <div className="flex flex-wrap gap-2">
              {open.registrationUrl && (
                <a href={open.registrationUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-heritage px-4 font-semibold text-white">官方報名<ExternalLink className="h-4 w-4" /></a>
              )}
              <button type="button" onClick={() => downloadIcs({ uid: open.id, title: open.title, start: new Date(open.startsAt), end: open.endsAt ? new Date(open.endsAt) : undefined, location: open.location, url: open.sourceUrl, alarmMinutesBefore: 60 }, `${open.title}.ics`)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <CalendarPlus className="h-4 w-4" />加入行事曆
              </button>
              <button type="button" onClick={() => share(open)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <Share2 className="h-4 w-4" />分享
              </button>
              <button type="button" aria-pressed={saved.includes(open.id)} onClick={() => toggle(open.id)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <Bookmark className={cn('h-4 w-4', saved.includes(open.id) && 'fill-heritage text-heritage')} />{saved.includes(open.id) ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
