import { Link } from 'react-router-dom';
import { isChinese } from '@/i18n';
import { t } from '@/i18n/t';
import { LEGAL } from './content';
import { LEGAL_LINKS } from './LegalPage';

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label={t('safety.legalNav')} className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-label ${className}`}>
      {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to} className="font-semibold text-link hover:underline">{LEGAL[isChinese() ? 'zh' : 'en'][l.key].title}</Link>)}
    </nav>
  );
}
