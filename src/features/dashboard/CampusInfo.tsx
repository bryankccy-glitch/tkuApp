import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useCampusEvents } from '@/lib/events';
import { QUICK_SERVICES } from '@/data/sources';
import { EVENT_CATEGORY_LABELS } from '@/lib/labels';
import { formatDateShort } from '@/lib/time';
import i18n from '@/i18n';
import { t } from '@/i18n/t';

export function CampusInfo() {
  const { data: events, isLoading, isError } = useCampusEvents();
  const upcoming = (events ?? []).slice(0, 3);

  return (
    <section aria-labelledby="campus-info" className="grid gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 id="campus-info" className="text-h3 text-ink">{t('home.events')}</h2>
          <Link to="/events" className="text-caption font-semibold text-link hover:underline">{t('common.seeAll')}</Link>
        </div>
        {isLoading ? (
          <p className="text-caption text-muted">{t('home.eventsLoading')}</p>
        ) : isError ? (
          <p className="text-caption text-danger">{t('home.eventsError')}</p>
        ) : events === null ? (
          <p className="rounded-sm bg-sunken px-3 py-3 text-caption text-muted">
            {t('home.eventsNotConnected')}
          </p>
        ) : upcoming.length === 0 ? (
          <p className="text-caption text-muted">{t('home.eventsEmpty')}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {upcoming.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-caption text-heritage">{EVENT_CATEGORY_LABELS[e.category]}｜{formatDateShort(new Date(e.startsAt))}</p>
                <Link to={`/events?id=${e.id}`} className="mt-0.5 block text-body font-semibold text-ink hover:underline">{e.title}</Link>
                <p className="mt-0.5 text-caption text-muted">
                  {t('common.source')}<a href={e.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">{e.sourceName}</a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-h3 text-ink">{t('home.services')}</h2>
        <ul className="grid grid-cols-2 gap-2">
          {QUICK_SERVICES.map((s) => (
            <li key={s.id}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex h-full flex-col justify-between gap-2 rounded-sm border border-line bg-surface p-3 transition-colors hover:border-primary/40"
              >
                <span className="text-body font-semibold leading-snug text-ink">{i18n.language === 'en' ? s.titleEn : s.title}</span>
                <span className="flex items-center justify-between gap-1 text-[11px] text-muted">
                  <span className="truncate">{i18n.language === 'en' ? new URL(s.url).hostname : s.publisher}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">{t('home.servicesNote')}</p>
      </div>
    </section>
  );
}
