import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

const TABS = [
  { to: '/explore', label: 'campus.places' },
  { to: '/events', label: 'campus.events' },
  { to: '/market', label: 'campus.market' },
] as const;

/** Section switcher under the 校園 tab: 地點 · 活動 · 市集 (keeps the bottom bar at five items). */
export function CampusTabs() {
  const { pathname } = useLocation();
  return (
    <nav aria-label={t('campus.sections')} className="mb-5 grid grid-cols-3 gap-1 rounded-sm bg-sunken p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn('flex h-9 items-center justify-center rounded-xs text-caption font-semibold transition-colors', active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
