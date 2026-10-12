import i18n from '@/i18n';
import { cn } from '@/lib/cn';
import type { MarketKind, MarketPost, MarketStatus } from '@/lib/social/types';
import { t } from '@/i18n/t';

/** "3 分鐘前" / "3 minutes ago", falling back to a date after a week. */
export function timeAgo(iso: string, now = new Date()): string {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(i18n.language === 'en' ? 'en' : 'zh-TW', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, 'minute');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-TW', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date(iso));
}

export function priceText(p: Pick<MarketPost, 'price' | 'kind'>): string {
  if (p.price === null) return t('market.priceNegotiable');
  if (p.price === 0) return p.kind === 'want' ? t('market.wantFree') : t('market.free');
  const amount = `NT$ ${p.price.toLocaleString('en-US')}`;
  return p.kind === 'want' ? t('market.budget', { amount }) : amount;
}

export function KindBadge({ kind }: { kind: MarketKind }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-bold', kind === 'sell' ? 'bg-primary text-white dark:text-[#1A0506]' : 'bg-ink text-canvas')}>
      {t(`market.kind.${kind}`)}
    </span>
  );
}

export function StatusBadge({ status }: { status: MarketStatus }) {
  if (status === 'open') return null;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[11px] font-semibold', status === 'reserved' ? 'border-heritage/40 text-heritage' : 'border-line text-muted')}>
      {t(`market.status.${status}`)}
    </span>
  );
}
