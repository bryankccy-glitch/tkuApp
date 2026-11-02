import { ExternalLink } from 'lucide-react';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { Page } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/misc';
import { Wordmark } from '@/components/brand/Logo';
import { OFFICIAL_SOURCES } from '@/data/sources';
import { NIGHT_PERIOD_SOURCE, PERIOD_SOURCE } from '@/lib/periods';
import { CAMPUS_CENTER } from '@/data/places';
import { t } from '@/i18n/t';
import { isChinese } from '@/i18n';

export default function AboutPage() {
  return (
    <Page>
      <PageHeader title={t('about.title')} />
      <div className="rounded-lg border border-line bg-surface p-5">
        <Wordmark />
        <p className="mt-4 text-body text-ink">{t('about.mission')}</p>
        <p className="mt-3 text-body text-muted">
          {t('about.unofficial1')}<strong className="text-ink">{t('about.unofficial2')}</strong>{t('about.unofficial3')} {t('about.colors')}
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-h3 text-ink">{t('about.privacy')}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-body text-muted">
          <li>{t('about.p1')}</li>
          <li>{t('about.p2')}</li>
          <li>{t('about.p3')}</li>
          <li>{t('about.p4')}</li>
          <li>{t('about.p5')}</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-h3 text-ink">{t('about.sources')}</h2>
        <p className="mt-1 text-caption text-muted">{t('about.checked')}</p>
        <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">{t('about.periods')}</span>{t('ai.colon')}<a className="text-link underline underline-offset-2" href={PERIOD_SOURCE.url} target="_blank" rel="noreferrer noopener">{PERIOD_SOURCE.name}</a>{t('about.nightPeriods')}<a className="text-link underline underline-offset-2" href={NIGHT_PERIOD_SOURCE.url} target="_blank" rel="noreferrer noopener">{NIGHT_PERIOD_SOURCE.name}</a></li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">{t('about.codes')}</span>{t('ai.colon')}{t('about.codesNote')}</li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">{t('about.location')}</span>{t('ai.colon')}<a className="text-link underline underline-offset-2" href={CAMPUS_CENTER.source.url} target="_blank" rel="noreferrer noopener">{CAMPUS_CENTER.source.name}</a>{t('about.locationNote')}</li>
          <li className="px-4 py-3 text-body"><span className="font-semibold text-ink">{t('about.mapTiles')}</span>{t('ai.colon')}© OpenStreetMap contributors</li>
        </ul>
        <h3 className="mt-5 text-body font-semibold text-ink">{t('about.official')}</h3>
        <ul className="mt-2 grid gap-1.5">
          {OFFICIAL_SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-body text-link underline underline-offset-2">{!isChinese() ? `${s.titleEn} (${s.title})` : s.title}<ExternalLink className="h-3.5 w-3.5" /></a>
              <span className="ml-2 text-caption text-muted">{s.publisher}{s.updated ? `｜${s.updated}` : ''}</span>
            </li>
          ))}
        </ul>
      </section>
      <LegalLinks className="mt-8" />
      <p className="mt-3 pb-2 text-center text-[11px] text-muted">TKU Campus OS · {__BUILD__}</p>
    </Page>
  );
}
