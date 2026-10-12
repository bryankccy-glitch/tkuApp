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
import { t } from '@/i18n/t';

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
      else { await navigator.clipboard.writeText(url); toast({ tone: 'success', message: t('events.copied') }); }
    } catch { /* user cancelled */ }
  };

  return (
    <Page wide>
      <PageHeader title={t('events.title')} subtitle={t('events.subtitle')} />

      {data === null ? (
        <EmptyState title={t('events.notConnectedTitle')} body={t('events.notConnectedBody')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="ev-q" className="sr-only">{t('events.search')}</label>
              <input id="ev-q" className="field pl-9" placeholder={t('events.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="sr-only" htmlFor="ev-cat">{t('events.category')}</label>
            <select id="ev-cat" className="field" value={cat} onChange={(e) => setCat(e.target.value as 'all' | EventCategory)}>
              <option value="all">{t('events.allCategories')}</option>
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
            </select>
            <label className="sr-only" htmlFor="ev-range">{t('events.date')}</label>
            <select id="ev-range" className="field" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="all">{t('events.allDates')}</option>
              <option value="week">{t('events.week')}</option>
              <option value="month">{t('events.month')}</option>
              <option value="saved">{t('events.saved')}</option>
            </select>
          </div>

          {isLoading ? <LoadingMark /> : error ? <div className="mt-4"><ErrorNotice error={error} onRetry={refetch} /></div> : list.length === 0 ? (
            <EmptyState title={t('events.noMatch')} body={t('events.noMatchBody')} />
          ) : (
            <ul className="mt-4 grid gap-3">
              {list.map((e) => (
                <li key={e.id} className="flex flex-col rounded-sm border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-caption font-semibold text-heritage">{EVENT_CATEGORY_LABELS[e.category]}</p>
                    <button type="button" aria-pressed={saved.includes(e.id)} aria-label={saved.includes(e.id) ? t('events.unsave') : t('events.save')} onClick={() => toggle(e.id)} className="-m-1 rounded-xs p-1 text-muted hover:text-ink">
                      <Bookmark className={cn('h-5 w-5', saved.includes(e.id) && 'fill-heritage text-heritage')} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setParams({ id: e.id })} className="mt-1 text-left text-h3 text-ink hover:underline">{e.title}</button>
                  <p className="tabular mt-1 text-caption text-muted">{formatDateShort(new Date(e.startsAt))} {formatTime(new Date(e.startsAt))}{e.location ? `｜${e.location}` : ''}</p>
                  <p className="mt-2 line-clamp-2 text-caption text-muted">{e.summary}</p>
                  <p className="mt-auto pt-3 text-[11px] text-muted">{t('events.sourceLine', { name: e.sourceName })}</p>
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
              <dt className="text-muted">{t('events.time')}</dt>
              <dd className="tabular text-ink">{formatDateShort(new Date(open.startsAt))} {formatTime(new Date(open.startsAt))}{open.endsAt ? ` – ${formatTime(new Date(open.endsAt))}` : ''}</dd>
              {open.location && <><dt className="text-muted">{t('events.location')}</dt><dd className="text-ink">{open.location}</dd></>}
              <dt className="text-muted">{t('events.source')}</dt>
              <dd><a href={open.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-link hover:underline">{open.sourceName}<ExternalLink className="h-3.5 w-3.5" /></a></dd>
              <dt className="text-muted">{t('events.published')}</dt>
              <dd className="text-ink">{formatDateShort(new Date(open.publishedAt))}</dd>
            </dl>
            <p className="whitespace-pre-wrap text-body text-ink">{open.summary}</p>
            <div className="flex flex-wrap gap-2">
              {open.registrationUrl && (
                <a href={open.registrationUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-heritage px-4 font-semibold text-white">{t('events.register')}<ExternalLink className="h-4 w-4" /></a>
              )}
              <button type="button" onClick={() => downloadIcs({ uid: open.id, title: open.title, start: new Date(open.startsAt), end: open.endsAt ? new Date(open.endsAt) : undefined, location: open.location, url: open.sourceUrl, alarmMinutesBefore: 60 }, `${open.title}.ics`)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <CalendarPlus className="h-4 w-4" />{t('events.addCalendar')}
              </button>
              <button type="button" onClick={() => share(open)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <Share2 className="h-4 w-4" />{t('events.share')}
              </button>
              <button type="button" aria-pressed={saved.includes(open.id)} onClick={() => toggle(open.id)} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line px-3 font-semibold text-ink hover:bg-sunken">
                <Bookmark className={cn('h-4 w-4', saved.includes(open.id) && 'fill-heritage text-heritage')} />{saved.includes(open.id) ? t('events.saved') : t('events.saveShort')}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
