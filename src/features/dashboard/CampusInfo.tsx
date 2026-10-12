import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useCampusEvents } from '@/lib/events';
import { QUICK_SERVICES } from '@/data/sources';
import { EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatDateShort } from '@/lib/time';

export function CampusInfo() {
  const { data: events, isLoading, isError } = useCampusEvents();
  const upcoming = (events ?? []).slice(0, 3);

  return (
    <section aria-labelledby="campus-info" className="grid gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 id="campus-info" className="text-h3 text-ink">近期活動與機會</h2>
          <Link to="/events" className="text-caption font-semibold text-blue hover:underline">查看全部</Link>
        </div>
        {isLoading ? (
          <p className="text-caption text-muted">載入中…</p>
        ) : isError ? (
          <p className="text-caption text-danger">活動資料暫時無法載入，請稍後再試。</p>
        ) : events === null ? (
          <p className="rounded-sm bg-sunken px-3 py-3 text-caption text-muted">
            活動由管理後台維護，連線雲端資料庫後才會顯示。每則活動都會附上來源、日期與官方連結。
          </p>
        ) : upcoming.length === 0 ? (
          <p className="text-caption text-muted">近期沒有已發布的活動。</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {upcoming.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-caption text-heritage">{EVENT_CATEGORY_LABELS[e.category]}｜{formatDateShort(new Date(e.startsAt))}</p>
                <Link to={`/events?id=${e.id}`} className="mt-0.5 block text-body font-semibold text-ink hover:underline">{e.title}</Link>
                <p className="mt-0.5 text-caption text-muted">
                  來源：<a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">{e.sourceName}</a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-h3 text-ink">常用校園服務</h2>
        <ul className="grid grid-cols-2 gap-2">
          {QUICK_SERVICES.map((s) => (
            <li key={s.id}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex h-full flex-col justify-between gap-2 rounded-sm border border-line bg-surface p-3 transition-colors hover:border-primary/40"
              >
                <span className="text-body font-semibold leading-snug text-ink">{s.title}</span>
                <span className="flex items-center justify-between gap-1 text-[11px] text-muted">
                  <span className="truncate">{s.publisher}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">連結皆指向淡江大學官方網站，2026-10-12 查核。</p>
      </div>
    </section>
  );
}
