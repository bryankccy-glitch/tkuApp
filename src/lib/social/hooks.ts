import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import { useAuth } from '@/app/AuthProvider';
import { SocialError } from './supabaseSocial';
import type { MarketPostInput, MarketStatus, ReportReason, SocialApi } from './types';

/** The signed-in user's social API, or null in 本機/訪客模式. */
export function useSocial(): SocialApi | null {
  return useAuth().repo?.social ?? null;
}

function need(s: SocialApi | null): SocialApi {
  if (!s) throw new Error(i18n.t('social.needAccount'));
  return s;
}

const k = {
  code: (u: string) => [u, 'social', 'code'] as const,
  friends: (u: string) => [u, 'social', 'friends'] as const,
  friendSchedule: (u: string, f: string, sem: string) => [u, 'social', 'friend-schedule', f, sem] as const,
  posts: (u: string) => [u, 'market', 'posts'] as const,
  post: (u: string, id: string) => [u, 'market', 'post', id] as const,
  comments: (u: string, id: string) => [u, 'market', 'comments', id] as const,
};

/** Friendly, translated message for any social/market error. */
export function socialErrorMessage(e: unknown): string {
  if (e instanceof SocialError) {
    if (e.code === 'rate_limit') return i18n.t('social.err.rateLimit');
    if (e.code === 'closed') return i18n.t('market.err.closed');
    if (e.code === 'duplicate') return i18n.t('market.err.alreadyReported');
    if (e.code === 'not_found') return i18n.t('social.err.notFound');
  }
  return i18n.t('social.err.generic');
}

// ───────────── friends ─────────────
export function useFriendCode() {
  const s = useSocial();
  return useQuery({ queryKey: k.code(s?.userId ?? ''), queryFn: () => need(s).getFriendCode(), enabled: Boolean(s), staleTime: Infinity });
}

export function useFriends() {
  const s = useSocial();
  return useQuery({ queryKey: k.friends(s?.userId ?? ''), queryFn: () => need(s).listFriends(), enabled: Boolean(s), refetchInterval: 60_000 });
}

export function useFriendSchedule(friendId: string | null, semesterCode: string | undefined) {
  const s = useSocial();
  return useQuery({
    queryKey: k.friendSchedule(s?.userId ?? '', friendId ?? '', semesterCode ?? ''),
    queryFn: () => need(s).getFriendSchedule(friendId!, semesterCode!),
    enabled: Boolean(s && friendId && semesterCode),
  });
}

export function useFriendMutations() {
  const s = useSocial();
  const qc = useQueryClient();
  const u = s?.userId ?? '';
  const refresh = () => qc.invalidateQueries({ queryKey: [u, 'social'] });
  return {
    send: useMutation({ mutationFn: (code: string) => need(s).sendFriendRequest(code), onSuccess: refresh }),
    respond: useMutation({ mutationFn: (v: { id: string; accept: boolean }) => need(s).respondFriendRequest(v.id, v.accept), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => need(s).removeFriendship(id), onSuccess: refresh }),
    regenerate: useMutation({
      mutationFn: () => need(s).regenerateFriendCode(),
      onSuccess: (code) => qc.setQueryData(k.code(u), code),
    }),
  };
}

// ───────────── 二手市集 ─────────────
export function useMarketPosts() {
  const s = useSocial();
  return useQuery({ queryKey: k.posts(s?.userId ?? ''), queryFn: () => need(s).listMarketPosts(), enabled: Boolean(s) });
}

export function useMarketPost(id: string | null) {
  const s = useSocial();
  return useQuery({ queryKey: k.post(s?.userId ?? '', id ?? ''), queryFn: () => need(s).getMarketPost(id!), enabled: Boolean(s && id) });
}

export function useComments(postId: string | null) {
  const s = useSocial();
  return useQuery({ queryKey: k.comments(s?.userId ?? '', postId ?? ''), queryFn: () => need(s).listComments(postId!), enabled: Boolean(s && postId), refetchInterval: 30_000 });
}

export function useMarketMutations() {
  const s = useSocial();
  const qc = useQueryClient();
  const u = s?.userId ?? '';
  const refresh = () => qc.invalidateQueries({ queryKey: [u, 'market'] });
  return {
    create: useMutation({ mutationFn: (input: MarketPostInput) => need(s).createMarketPost(input), onSuccess: refresh }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Partial<MarketPostInput & { status: MarketStatus }> }) => need(s).updateMarketPost(v.id, v.patch),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => need(s).deleteMarketPost(id), onSuccess: refresh }),
    comment: useMutation({ mutationFn: (v: { postId: string; body: string }) => need(s).addComment(v.postId, v.body), onSuccess: refresh }),
    removeComment: useMutation({ mutationFn: (id: string) => need(s).deleteComment(id), onSuccess: refresh }),
    report: useMutation({ mutationFn: (v: { postId: string; reason: ReportReason; note?: string }) => need(s).reportPost(v.postId, v.reason, v.note) }),
  };
}
