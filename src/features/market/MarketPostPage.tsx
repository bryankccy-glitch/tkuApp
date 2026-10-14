import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Pencil, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { EmptyState, ErrorNotice, Segmented } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { SignInRequired } from '@/components/ui/SignInRequired';
import { useToast } from '@/components/ui/Toast';
import { LoadingMark } from '@/components/brand/Logo';
import { socialErrorMessage, useComments, useMarketMutations, useMarketPost, useSocial } from '@/lib/social/hooks';
import { REPORT_REASONS, type MarketPost, type MarketStatus, type ReportReason } from '@/lib/social/types';
import { KindBadge, StatusBadge, priceText, timeAgo } from './marketUi';
import { PostForm } from './PostForm';
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
  const [reportOpen, setReportOpen] = useState(false);

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
        <button type="button" onClick={() => setReportOpen(true)} className="mx-auto mt-8 flex items-center gap-1.5 text-label font-semibold text-muted hover:text-danger">
          <Flag className="h-3.5 w-3.5" />{t('market.report')}
        </button>
      )}

      <PostForm
        open={editOpen}
        initial={p}
        onClose={() => setEditOpen(false)}
        saving={m.update.isPending}
        onSubmit={async (v) => { if (await run(() => m.update.mutateAsync({ id: p.id, patch: v }), t('market.saved'))) setEditOpen(false); }}
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
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} post={p}
        onSubmit={async (reason, note) => { if (await run(() => m.report.mutateAsync({ postId: p.id, reason, note }), t('market.reported'))) setReportOpen(false); }} />
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

function ReportSheet({ open, onClose, post, onSubmit }: { open: boolean; onClose: () => void; post: MarketPost; onSubmit: (r: ReportReason, note?: string) => void }) {
  const [reason, setReason] = useState<ReportReason>('prohibited');
  const [note, setNote] = useState('');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('market.reportTitle')}
      description={post.title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" className="flex-1" onClick={() => onSubmit(reason, note)}>{t('market.reportSend')}</Button>
        </>
      }
    >
      <fieldset>
        <legend className="label">{t('market.reportReason')}</legend>
        <div className="grid gap-1.5">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2.5 rounded-sm border border-line px-3 py-2.5 text-body text-ink has-[:checked]:border-primary">
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4" />
              {t(`market.reason.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="report-note" className="label mt-3">{t('market.reportNote')}</label>
      <textarea id="report-note" rows={2} maxLength={500} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
    </Sheet>
  );
}
