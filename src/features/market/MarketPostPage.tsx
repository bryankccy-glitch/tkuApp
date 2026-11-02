import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Flag, Pencil, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, ErrorNotice, Segmented } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { SignInRequired } from '@/components/ui/SignInRequired';
import { useToast } from '@/components/ui/Toast';
import { LoadingMark } from '@/components/brand/Logo';
import { socialErrorMessage, useComments, useMarketMutations, useMarketPost, useRulesAccepted, useSocial } from '@/lib/social/hooks';
import type { MarketStatus, ReportTarget } from '@/lib/social/types';
import { KindBadge, StatusBadge, priceText, timeAgo } from './marketUi';
import { PostForm, RulesList } from './PostForm';
import { ReportSheet } from './ReportSheet';
import { t } from '@/i18n/t';

export default function MarketPostPage() {
  const social = useSocial();
  return (
    <Page>
      <Link to="/market" className="mb-3 inline-flex items-center gap-1.5 text-caption font-semibold text-link hover:underline">
        <ArrowLeft className="h-4 w-4" />{t('market.backToList')}
      </Link>
      {social ? <PostDetail userId={social.userId} /> : <SignInRequired title={t('market.needAccountTitle')} body={t('market.needAccountBody')} />}
    </Page>
  );
}

function PostDetail({ userId }: { userId: string }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const post = useMarketPost(id);
  const comments = useComments(id);
  const m = useMarketMutations();
  const [body, setBody] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState<{ target: ReportTarget; subject: string } | null>(null);
  const [blocking, setBlocking] = useState<{ userId: string; name: string } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const rules = useRulesAccepted();

  if (post.isLoading) return <LoadingMark />;
  if (post.error) return <ErrorNotice error={post.error} onRetry={() => post.refetch()} />;
  const p = post.data;
  if (!p) return <EmptyState title={t('market.notFoundTitle')} body={t('market.notFoundBody')} />;
  const mine = p.userId === userId;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast({ tone: 'success', message: ok }); return true; } catch (e) { toast({ tone: 'error', message: socialErrorMessage(e) }); return false; }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (rules.data === false) return setRulesOpen(true);
    if (await run(() => m.comment.mutateAsync({ postId: p.id, body: text }))) setBody('');
  };

  return (
    <article aria-labelledby="post-title">
      <div className="flex items-start gap-2">
        <KindBadge kind={p.kind} />
        <StatusBadge status={p.status} />
      </div>
      <h1 id="post-title" className="mt-2 text-h2 text-ink">{p.title}</h1>
      <p className="mt-1 text-h3 font-bold text-primary">{priceText(p)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-sm border border-line bg-surface p-3 text-caption">
        <Info label={t('market.form.category')} value={t(`market.category.${p.category}`)} />
        {p.condition && <Info label={t('market.form.condition')} value={t(`market.condition.${p.condition}`)} />}
        {p.courseCode && <Info label={t('market.form.courseCode')} value={p.courseCode} />}
        <Info label={t('market.postedBy')} value={`${p.authorName} · ${timeAgo(p.createdAt)}`} />
      </dl>
      {p.photos.length > 0 && (
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
          {p.photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="shrink-0 snap-start">
              <img src={url} alt={t('market.photoAlt', { n: i + 1 })} className="h-56 max-w-[85vw] rounded-sm border border-line object-cover" />
            </a>
          ))}
        </div>
      )}
      {p.description && <p className="mt-4 whitespace-pre-wrap break-words text-body text-ink">{p.description}</p>}

      {mine ? (
        <section aria-labelledby="owner-tools" className="mt-5 rounded-lg border border-line bg-surface p-4">
          <h2 id="owner-tools" className="text-body font-semibold text-ink">{t('market.manage')}</h2>
          <Segmented<MarketStatus>
            label={t('market.statusLabel')}
            className="mt-2 [&>button]:flex-1 [&>button]:justify-center"
            value={p.status}
            onChange={(status) => run(() => m.update.mutateAsync({ id: p.id, patch: { status } }), t('market.statusChanged'))}
            options={[{ value: 'open', label: t('market.status.open') }, { value: 'reserved', label: t('market.status.reserved') }, { value: 'closed', label: t('market.status.closed') }]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />{t('market.edit')}</Button>
            <Button variant="secondary" className="text-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />{t('market.delete')}</Button>
          </div>
        </section>
      ) : (
        <div className="mt-4 flex items-start gap-2 rounded-sm bg-sunken p-3 text-label text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>{t('market.safetyTip')}</p>
        </div>
      )}

      <section aria-labelledby="comments-title" className="mt-6">
        <h2 id="comments-title" className="mb-3 text-h3 text-ink">{t('market.comments', { count: comments.data?.length ?? 0 })}</h2>
        {comments.isLoading ? <LoadingMark compact /> : comments.error ? <ErrorNotice error={comments.error} onRetry={() => comments.refetch()} /> : (
          (comments.data ?? []).length === 0 ? (
            <p className="rounded-sm bg-sunken px-4 py-4 text-caption text-muted">{p.kind === 'sell' ? t('market.noCommentsSell') : t('market.noCommentsWant')}</p>
          ) : (
            <ul className="grid gap-2">
              {(comments.data ?? []).map((c) => (
                <li key={c.id} className="rounded-sm border border-line bg-surface px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2 text-label text-muted">
                    <span className="truncate font-semibold text-ink">
                      {c.authorName}{c.userId === p.userId && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{t('market.author')}</span>}
                    </span>
                    <span className="shrink-0">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink">{c.body}</p>
                  {(c.userId === userId || mine) && (
                    <button type="button" onClick={() => run(() => m.removeComment.mutateAsync(c.id), t('market.commentDeleted'))} className="mt-1 text-label font-semibold text-muted hover:text-danger">
                      {t('market.deleteComment')}
                    </button>
                  )}
                  {c.userId !== userId && (
                    <div className="mt-1 flex gap-3 text-label font-semibold text-muted">
                      <button type="button" className="hover:text-danger" onClick={() => setReporting({ target: { type: 'comment', id: c.id }, subject: c.body.slice(0, 60) })}>{t('safety.reportComment')}</button>
                      <button type="button" className="hover:text-danger" onClick={() => setBlocking({ userId: c.userId, name: c.authorName })}>{t('safety.block')}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        {p.status === 'closed' ? (
          <p className="mt-3 text-center text-caption text-muted">{t('market.closedNoComments')}</p>
        ) : (
          <form onSubmit={send} className="mt-3 flex items-end gap-2">
            <label htmlFor="comment" className="sr-only">{t('market.commentLabel')}</label>
            <textarea id="comment" rows={2} maxLength={1000} className="field flex-1 resize-none" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={mine ? t('market.replyPh') : p.kind === 'sell' ? t('market.commentPhSell') : t('market.commentPhWant')} />
            <Button type="submit" aria-label={t('market.sendComment')} loading={m.comment.isPending} disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        )}
      </section>

      {!mine && (
        <div className="mt-8 flex justify-center gap-5 text-label font-semibold text-muted">
          <button type="button" onClick={() => setReporting({ target: { type: 'post', id: p.id }, subject: p.title })} className="flex items-center gap-1.5 hover:text-danger">
            <Flag className="h-3.5 w-3.5" />{t('market.report')}
          </button>
          <button type="button" onClick={() => setReporting({ target: { type: 'user', id: p.userId }, subject: p.authorName })} className="flex items-center gap-1.5 hover:text-danger">
            <Flag className="h-3.5 w-3.5" />{t('safety.reportUser')}
          </button>
          <button type="button" onClick={() => setBlocking({ userId: p.userId, name: p.authorName })} className="flex items-center gap-1.5 hover:text-danger">
            <Ban className="h-3.5 w-3.5" />{t('safety.block')}
          </button>
        </div>
      )}

      <PostForm
        open={editOpen}
        initial={p}
        onClose={() => setEditOpen(false)}
        saving={m.update.isPending}
        onSubmit={async (v) => {
          const saved = await run(() => m.update.mutateAsync({ id: p.id, patch: v }), t('market.saved'));
          if (saved) setEditOpen(false);
          return saved;
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('market.deleteTitle')}
        message={t('market.deleteBody')}
        confirmLabel={t('market.delete')}
        loading={m.remove.isPending}
        onConfirm={async () => { if (await run(() => m.remove.mutateAsync(p.id), t('market.deleted'))) navigate('/market', { replace: true }); }}
      />
      <ReportSheet open={reporting !== null} onClose={() => setReporting(null)} subject={reporting?.subject ?? ''}
        onSubmit={async (reason, note) => { if (reporting && await run(() => m.report.mutateAsync({ target: reporting.target, reason, note }), t('safety.reported'))) setReporting(null); }} />
      <ConfirmSheet
        open={blocking !== null}
        onClose={() => setBlocking(null)}
        title={t('safety.blockTitle', { name: blocking?.name ?? '' })}
        message={t('safety.blockBody')}
        confirmLabel={t('safety.block')}
        loading={m.block.isPending}
        onConfirm={async () => {
          if (!blocking) return;
          const leaving = blocking.userId === p.userId;
          if (await run(() => m.block.mutateAsync(blocking.userId), t('safety.blocked'))) { setBlocking(null); if (leaving) navigate('/market', { replace: true }); }
        }}
      />
      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={t('safety.rulesTitle')} size="sm"
        footer={<Button className="flex-1" loading={m.acceptRules.isPending} onClick={async () => { if (await run(() => m.acceptRules.mutateAsync())) setRulesOpen(false); }}>{t('safety.rulesAccept')}</Button>}>
        <RulesList />
      </Sheet>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="truncate font-semibold text-ink">{value}</dd>
    </div>
  );
}
