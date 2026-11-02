import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, Search, X } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, ErrorNotice, PageHeader, Segmented } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { SignInRequired } from '@/components/ui/SignInRequired';
import { useToast } from '@/components/ui/Toast';
import { LoadingMark } from '@/components/brand/Logo';
import { CampusTabs } from '@/features/explore/CampusTabs';
import { socialErrorMessage, useMarketMutations, useMarketPosts, useSocial } from '@/lib/social/hooks';
import { MARKET_CATEGORIES, type MarketCategory, type MarketPost } from '@/lib/social/types';
import { cn } from '@/lib/cn';
import { KindBadge, StatusBadge, priceText, timeAgo } from './marketUi';
import { PostForm } from './PostForm';
import { t } from '@/i18n/t';

type Filter = 'all' | 'sell' | 'want' | 'mine';

export function filterPosts(posts: MarketPost[], opts: { q: string; filter: Filter; cat: 'all' | MarketCategory; userId: string; showClosed: boolean }) {
  const q = opts.q.trim().toLowerCase();
  return posts.filter((p) => {
    if (opts.filter === 'mine' ? p.userId !== opts.userId : opts.filter !== 'all' && p.kind !== opts.filter) return false;
    if (opts.cat !== 'all' && p.category !== opts.cat) return false;
    // Your own finished posts stay visible under 「我的」; everyone else's are hidden unless asked.
    if (p.status === 'closed' && !opts.showClosed && opts.filter !== 'mine') return false;
    if (q && !`${p.title} ${p.description} ${p.courseCode ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export default function MarketPage() {
  const social = useSocial();
  return (
    <Page>
      <PageHeader title={t('market.title')} subtitle={t('market.subtitle')} />
      <CampusTabs />
      {social ? <MarketFeed userId={social.userId} /> : <SignInRequired title={t('market.needAccountTitle')} body={t('market.needAccountBody')} />}
    </Page>
  );
}

function MarketFeed({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useMarketPosts();
  const { create } = useMarketMutations();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState<'all' | MarketCategory>('all');
  const [showClosed, setShowClosed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const list = useMemo(() => filterPosts(data ?? [], { q, filter, cat, userId, showClosed }), [data, q, filter, cat, userId, showClosed]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="mk-q" className="sr-only">{t('market.search')}</label>
          <input id="mk-q" className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('market.searchPh')} />
          {q && <button type="button" aria-label={t('explore.clear')} onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs p-1 text-muted hover:text-ink"><X className="h-4 w-4" /></button>}
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />{t('market.newPost')}</Button>
      </div>

      <Segmented<Filter>
        label={t('market.filterLabel')}
        className="mb-3 [&>button]:flex-1 [&>button]:justify-center"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('market.filter.all') },
          { value: 'sell', label: t('market.filter.sell') },
          { value: 'want', label: t('market.filter.want') },
          { value: 'mine', label: t('market.filter.mine') },
        ]}
      />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label={t('market.categoryLabel')}>
        {(['all', ...MARKET_CATEGORIES] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
            className={cn('h-8 shrink-0 rounded-full border px-3 text-caption font-semibold', cat === c ? 'border-primary bg-primary text-white dark:text-[#1A0506]' : 'border-line text-muted hover:text-ink')}>
            {c === 'all' ? t('market.category.all') : t(`market.category.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingMark /> : error ? <ErrorNotice error={error} onRetry={() => refetch()} /> : list.length === 0 ? (
        <EmptyState
          title={filter === 'mine' ? t('market.emptyMineTitle') : t('market.emptyTitle')}
          body={t('market.emptyBody')}
          action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />{t('market.newPost')}</Button>}
        />
      ) : (
        <ul className="grid gap-2.5">
          {list.map((p) => (
            <li key={p.id}>
              <Link to={`/market/${p.id}`} className={cn('flex gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:bg-sunken', p.status === 'closed' && 'opacity-60')}>
                {p.photos[0] && <img src={p.photos[0]} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-sm border border-line object-cover" />}
                <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <KindBadge kind={p.kind} />
                  <p className="min-w-0 flex-1 text-body font-semibold leading-snug text-ink">{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-2 text-body-lg font-bold text-primary">{priceText(p)}</p>
                <p className="mt-1 truncate text-caption text-muted">
                  {[t(`market.category.${p.category}`), p.condition ? t(`market.condition.${p.condition}`) : null, p.courseCode].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex items-center justify-between text-label text-muted">
                  <span className="truncate">{p.authorName} · {timeAgo(p.createdAt)}</span>
                  <span className="inline-flex shrink-0 items-center gap-1" aria-label={t('market.commentCount', { count: p.commentCount })}>
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />{p.commentCount}
                  </span>
                </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filter !== 'mine' && (data ?? []).some((p) => p.status === 'closed') && (
        <label className="mt-4 flex items-center justify-center gap-2 text-caption text-muted">
          <input type="checkbox" className="h-4 w-4" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          {t('market.showClosed')}
        </label>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">{t('market.footerNotice')}</p>

      <PostForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        saving={create.isPending}
        onSubmit={async (v) => {
          try {
            const post = await create.mutateAsync(v);
            setFormOpen(false);
            toast({ tone: 'success', message: t('market.posted') });
            navigate(`/market/${post.id}`);
            return true;
          } catch (e) {
            toast({ tone: 'error', message: socialErrorMessage(e) });
            return false;
          }
        }}
      />
    </div>
  );
}
