import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { isChinese } from '@/i18n';
import { t } from '@/i18n/t';
import { LEGAL, LEGAL_UPDATED, SUPPORT_EMAIL, type LegalKey } from './content';

export const LEGAL_LINKS: { to: string; key: LegalKey }[] = [
  { to: '/privacy', key: 'privacy' }, { to: '/terms', key: 'terms' }, { to: '/support', key: 'support' }, { to: '/delete-account', key: 'delete' },
];

/** Public pages: stores and people without an account must be able to open them. */
export default function LegalPage({ doc }: { doc: LegalKey }) {
  const text = LEGAL[isChinese() ? 'zh' : 'en'][doc];
  return (
    <main id="main" className="mx-auto min-h-dvh max-w-2xl bg-bg px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/" className="inline-flex items-center gap-1.5 text-caption font-semibold text-link hover:underline"><ArrowLeft className="h-4 w-4" />{t('safety.home')}</Link>
      <h1 className="mt-4 text-h1 text-ink">{text.title}</h1>
      <p className="mt-1 text-caption text-muted">{t('safety.updated', { date: LEGAL_UPDATED })}</p>
      {text.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="text-h3 text-ink">{s.heading}</h2>
          {s.body.map((p) => <p key={p} className="mt-2 text-body leading-relaxed text-muted">{p}</p>)}
        </section>
      ))}
      {(doc === 'support' || doc === 'delete' || doc === 'privacy') && SUPPORT_EMAIL && (
        <p className="mt-6 text-body text-ink">{t('safety.contactEmail')}<a className="font-semibold text-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      )}
      <nav aria-label={t('safety.legalNav')} className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-caption">
        {LEGAL_LINKS.filter((l) => l.key !== doc).map((l) => <Link key={l.to} to={l.to} className="font-semibold text-link hover:underline">{LEGAL[isChinese() ? 'zh' : 'en'][l.key].title}</Link>)}
      </nav>
    </main>
  );
}
