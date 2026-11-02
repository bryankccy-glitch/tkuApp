import { useEffect, useState, type FormEvent } from 'react';
import { Check, ChevronRight, Copy, RefreshCw, Share2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorNotice, SectionTitle } from '@/components/ui/misc';
import { SignInRequired } from '@/components/ui/SignInRequired';
import { useToast } from '@/components/ui/Toast';
import { LoadingMark } from '@/components/brand/Logo';
import { socialErrorMessage, useBlockedUsers, useFriendCode, useFriendMutations, useFriends, useMarketMutations, useSocial, useUnblock } from '@/lib/social/hooks';
import { ReportSheet } from '@/features/market/ReportSheet';
import type { FriendEntry, FriendRequestResult } from '@/lib/social/types';
import type { Course } from '@/lib/types';
import { FriendSchedule } from './FriendSchedule';
import { t } from '@/i18n/t';

/** Absolute link that opens the app on 課表 › 好友 with the code filled in (works with hash routing too). */
export function inviteLink(code: string) {
  const path = `/schedule?tab=friends&code=${encodeURIComponent(code)}`;
  if (import.meta.env.VITE_HASH_ROUTER === '1') return `${location.origin}${location.pathname}#${path}`;
  return `${location.origin}${path}`;
}

const RESULT_TONE: Record<FriendRequestResult, 'success' | 'error'> = {
  sent: 'success', accepted: 'success', already_friends: 'success', pending: 'success', self: 'error', not_found: 'error',
};

export function FriendsPanel({ myCourses, semesterCode, initialCode }: { myCourses: Course[]; semesterCode?: string; initialCode?: string | null }) {
  const social = useSocial();
  if (!social) return <SignInRequired title={t('friends.needAccountTitle')} body={t('friends.needAccountBody')} />;
  return <FriendsInner myCourses={myCourses} semesterCode={semesterCode} initialCode={initialCode} />;
}

function FriendsInner({ myCourses, semesterCode, initialCode }: { myCourses: Course[]; semesterCode?: string; initialCode?: string | null }) {
  const toast = useToast();
  const code = useFriendCode();
  const friends = useFriends();
  const m = useFriendMutations();
  const [input, setInput] = useState(initialCode ?? '');
  const [viewing, setViewing] = useState<FriendEntry | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [blocking, setBlocking] = useState<FriendEntry | null>(null);
  const [reporting, setReporting] = useState<FriendEntry | null>(null);
  const market = useMarketMutations();
  const blockedUsers = useBlockedUsers();
  const unblock = useUnblock();

  useEffect(() => { if (initialCode) setInput(initialCode); }, [initialCode]);

  const list = friends.data ?? [];
  const incoming = list.filter((f) => f.direction === 'incoming');
  const outgoing = list.filter((f) => f.direction === 'outgoing');
  const accepted = list.filter((f) => f.direction === 'friend');

  if (viewing) {
    return <FriendSchedule friend={viewing} myCourses={myCourses} semesterCode={semesterCode} onBack={() => setViewing(null)} />;
  }

  const share = async () => {
    if (!code.data) return;
    const url = inviteLink(code.data);
    try {
      if (navigator.share) {
        await navigator.share({ title: t('friends.shareTitle'), text: t('friends.shareText', { code: code.data }), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ tone: 'success', message: t('friends.linkCopied') });
      }
    } catch { /* share sheet dismissed */ }
  };

  const copyCode = async () => {
    if (!code.data) return;
    try { await navigator.clipboard.writeText(code.data); toast({ tone: 'success', message: t('friends.codeCopied') }); } catch { /* clipboard blocked */ }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = input.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(c)) return toast({ tone: 'error', message: t('friends.codeInvalid') });
    try {
      const r = await m.send.mutateAsync(c);
      toast({ tone: RESULT_TONE[r], message: t(`friends.result.${r}`) });
      if (r === 'sent' || r === 'accepted' || r === 'already_friends' || r === 'pending') setInput('');
    } catch (err) {
      toast({ tone: 'error', message: socialErrorMessage(err) });
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast({ tone: 'success', message: ok }); } catch (err) { toast({ tone: 'error', message: socialErrorMessage(err) }); }
  };

  return (
    <div className="grid gap-5">
      <section aria-labelledby="f-code" className="rounded-lg border border-line bg-surface p-4">
        <h2 id="f-code" className="text-body font-semibold text-ink">{t('friends.myCode')}</h2>
        <p className="mt-0.5 text-caption text-muted">{t('friends.myCodeHint')}</p>
        <div className="mt-3 flex items-center gap-2">
          <output aria-live="polite" className="tabular flex-1 rounded-sm bg-sunken px-3 py-2.5 text-center font-mono text-[1.375rem] font-bold tracking-[0.2em] text-ink">
            {code.data ?? '········'}
          </output>
          <Button variant="secondary" onClick={copyCode} disabled={!code.data} aria-label={t('friends.copyCode')}><Copy className="h-4 w-4" /></Button>
        </div>
        <Button className="mt-3 w-full" onClick={share} disabled={!code.data}><Share2 className="h-4 w-4" />{t('friends.shareInvite')}</Button>
        <button type="button" onClick={() => setConfirmRegen(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-label font-semibold text-muted hover:text-ink">
          <RefreshCw className="h-3.5 w-3.5" />{t('friends.regenerate')}
        </button>
      </section>

      <section aria-labelledby="f-add">
        <h2 id="f-add" className="mb-2 text-h3 text-ink">{t('friends.add')}</h2>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="friend-code" className="sr-only">{t('friends.codeLabel')}</label>
          <input id="friend-code" className="field flex-1 font-mono uppercase tracking-[0.15em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal" maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            placeholder={t('friends.codePlaceholder')} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" loading={m.send.isPending}><UserPlus className="h-4 w-4" />{t('friends.send')}</Button>
        </form>
      </section>

      {friends.isLoading ? <LoadingMark /> : friends.error ? <ErrorNotice error={friends.error} onRetry={() => friends.refetch()} /> : (
        <>
          {incoming.length > 0 && (
            <section aria-labelledby="f-in">
              <SectionTitle id="f-in">{t('friends.incoming', { count: incoming.length })}</SectionTitle>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {incoming.map((f) => (
                  <li key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={f.displayName} />
                    <PersonText f={f} sub={t('friends.wantsToShare')} />
                    <button type="button" onClick={() => setBlocking(f)} className="text-label font-semibold text-muted hover:text-danger">{t('safety.block')}</button>
                    <Button size="sm" onClick={() => act(() => m.respond.mutateAsync({ id: f.friendshipId, accept: true }), t('friends.accepted', { name: f.displayName }))} aria-label={t('friends.acceptName', { name: f.displayName })}>
                      <Check className="h-4 w-4" />{t('friends.accept')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => m.respond.mutateAsync({ id: f.friendshipId, accept: false }), t('friends.declined'))} aria-label={t('friends.declineName', { name: f.displayName })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="f-list">
            <SectionTitle id="f-list">{t('friends.list', { count: accepted.length })}</SectionTitle>
            {accepted.length === 0 ? (
              <EmptyState compact title={t('friends.emptyTitle')} body={t('friends.emptyBody')} />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {accepted.map((f) => (
                  <li key={f.friendshipId} className="flex items-center">
                    <button type="button" onClick={() => setViewing(f)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                      <Avatar name={f.displayName} />
                      <PersonText f={f} sub={t('friends.viewSchedule')} />
                      <ChevronRight className="h-5 w-5 text-muted" />
                    </button>
                    <button type="button" onClick={() => setReporting(f)} className="shrink-0 py-3 pl-1 pr-2 text-label font-semibold text-muted hover:text-danger">{t('safety.report')}</button>
                    <button type="button" onClick={() => setBlocking(f)} className="shrink-0 py-3 pl-1 pr-3 text-label font-semibold text-muted hover:text-danger">{t('safety.block')}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {outgoing.length > 0 && (
            <section aria-labelledby="f-out">
              <SectionTitle id="f-out">{t('friends.outgoing')}</SectionTitle>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {outgoing.map((f) => (
                  <li key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={f.displayName} />
                    <PersonText f={f} sub={t('friends.waiting')} />
                    <Button size="sm" variant="secondary" onClick={() => act(() => m.remove.mutateAsync(f.friendshipId), t('friends.cancelled'))}>{t('friends.cancelRequest')}</Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {(blockedUsers.data?.length ?? 0) > 0 && (
        <section aria-labelledby="f-blocked">
          <SectionTitle id="f-blocked">{t('safety.blockedList')}</SectionTitle>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {blockedUsers.data!.map((b) => (
              <li key={b.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate text-body text-ink">{b.displayName}</span>
                <Button size="sm" variant="secondary" onClick={() => act(() => unblock.mutateAsync(b.userId), t('safety.unblocked'))}>{t('safety.unblock')}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted">{t('friends.privacy')}</p>

      <ReportSheet open={reporting !== null} onClose={() => setReporting(null)} subject={reporting?.displayName ?? ''}
        onSubmit={async (reason, note) => { if (reporting) { await act(() => market.report.mutateAsync({ target: { type: 'user', id: reporting.friendId }, reason, note }), t('safety.reported')); setReporting(null); } }} />
      <ConfirmSheet
        open={blocking !== null}
        onClose={() => setBlocking(null)}
        title={t('safety.blockTitle', { name: blocking?.displayName ?? '' })}
        message={t('safety.blockBody')}
        confirmLabel={t('safety.block')}
        onConfirm={async () => { if (blocking) { await act(() => market.block.mutateAsync(blocking.friendId), t('safety.blocked')); setBlocking(null); } }}
      />

      <ConfirmSheet
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title={t('friends.regenerateTitle')}
        message={t('friends.regenerateBody')}
        confirmLabel={t('friends.regenerateConfirm')}
        danger={false}
        loading={m.regenerate.isPending}
        onConfirm={() => act(async () => { await m.regenerate.mutateAsync(); setConfirmRegen(false); }, t('friends.regenerated'))}
      />
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body font-bold text-primary">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PersonText({ f, sub }: { f: FriendEntry; sub: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-body font-semibold text-ink">{f.displayName}</span>
      <span className="block truncate text-caption text-muted">{[f.department, sub].filter(Boolean).join(' · ')}</span>
    </span>
  );
}
