import type { SupabaseClient } from '@supabase/supabase-js';
import type { Course, CourseColor, Weekday } from '../types';
import type {
  FriendDirection, FriendEntry, FriendRequestResult, MarketCategory, MarketComment, MarketCondition, MarketKind,
  BlockedUser, MarketPost, MarketPostInput, MarketStatus, ReportReason, ReportTarget, SocialApi,
} from './types';

/** Error with a stable `code` the UI can translate (see `socialErrorKey`). */
export class SocialError extends Error {
  constructor(public code: 'rate_limit' | 'closed' | 'duplicate' | 'not_found' | 'rules_required' | 'blocked_term' | 'suspended' | 'blocked' | 'unknown', message: string) {
    super(message);
  }
}

function fail(err: { message: string; code?: string } | null): void {
  if (!err) return;
  const m = err.message;
  if (/rate limit|too many pending/i.test(m)) throw new SocialError('rate_limit', m);
  if (/post is closed/i.test(m)) throw new SocialError('closed', m);
  if (/rules required/i.test(m)) throw new SocialError('rules_required', m);
  if (/blocked term/i.test(m)) throw new SocialError('blocked_term', m);
  if (/account suspended/i.test(m)) throw new SocialError('suspended', m);
  if (/^blocked$/i.test(m)) throw new SocialError('blocked', m);
  if (err.code === '23505') throw new SocialError('duplicate', m);
  if (/not found/i.test(m)) throw new SocialError('not_found', m);
  throw new SocialError('unknown', m);
}

interface FriendRow { friendship_id: string; friend_id: string; display_name: string; department: string | null; direction: FriendDirection; created_at: string }
interface FriendScheduleRow {
  course_id: string; name: string; code: string | null; instructor: string | null; color: CourseColor;
  entry_id: string; weekday: number; start_time: string; end_time: string; room: string;
}
interface PostRow {
  id: string; user_id: string; author_name: string; kind: MarketKind; category: MarketCategory; title: string;
  description: string; price: number | null; course_code: string | null; condition: MarketCondition | null; photos: string[] | null;
  status: MarketStatus; created_at: string; updated_at: string; market_comments?: { count: number }[];
}
interface CommentRow { id: string; post_id: string; user_id: string; author_name: string; body: string; created_at: string }

const POST_COLS = 'id, user_id, author_name, kind, category, title, description, price, course_code, condition, photos, status, created_at, updated_at, market_comments(count)';

function mapPost(r: PostRow): MarketPost {
  return {
    id: r.id, userId: r.user_id, authorName: r.author_name, kind: r.kind, category: r.category, title: r.title,
    description: r.description, price: r.price, courseCode: r.course_code, condition: r.condition, status: r.status, photos: r.photos ?? [],
    commentCount: r.market_comments?.[0]?.count ?? 0, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
const mapComment = (r: CommentRow): MarketComment => ({ id: r.id, postId: r.post_id, userId: r.user_id, authorName: r.author_name, body: r.body, createdAt: r.created_at });

/** Groups flat (course × time slot) rows into read-only Course objects. */
export function groupFriendSchedule(rows: FriendScheduleRow[]): Course[] {
  const byId = new Map<string, Course>();
  for (const r of rows) {
    let c = byId.get(r.course_id);
    if (!c) {
      c = { id: r.course_id, semesterId: '', name: r.name, code: r.code ?? undefined, instructor: r.instructor ?? undefined, color: r.color, slots: [], createdAt: '', updatedAt: '' };
      byId.set(r.course_id, c);
    }
    c.slots.push({ id: r.entry_id, weekday: r.weekday as Weekday, startTime: r.start_time.slice(0, 5), endTime: r.end_time.slice(0, 5), room: r.room });
  }
  return [...byId.values()];
}

export class SupabaseSocial implements SocialApi {
  constructor(private db: SupabaseClient, readonly userId: string) {}

  async getFriendCode() {
    const { data, error } = await this.db.from('profiles').select('friend_code').eq('id', this.userId).single();
    fail(error);
    return (data as { friend_code: string }).friend_code;
  }

  async regenerateFriendCode() {
    const { data, error } = await this.db.rpc('regenerate_friend_code');
    fail(error);
    return data as string;
  }

  async listFriends(): Promise<FriendEntry[]> {
    const { data, error } = await this.db.rpc('list_friends');
    fail(error);
    return ((data ?? []) as FriendRow[]).map((r) => ({
      friendshipId: r.friendship_id, friendId: r.friend_id, displayName: r.display_name,
      department: r.department ?? undefined, direction: r.direction, createdAt: r.created_at,
    }));
  }

  async sendFriendRequest(code: string) {
    const { data, error } = await this.db.rpc('send_friend_request', { code: code.trim().toUpperCase() });
    fail(error);
    return data as FriendRequestResult;
  }

  async respondFriendRequest(friendshipId: string, accept: boolean) {
    fail((await this.db.rpc('respond_friend_request', { request_id: friendshipId, accept })).error);
  }

  async removeFriendship(friendshipId: string) {
    fail((await this.db.rpc('remove_friendship', { friendship_id: friendshipId })).error);
  }

  async getFriendSchedule(friendId: string, semesterCode: string) {
    const { data, error } = await this.db.rpc('get_friend_schedule', { friend: friendId, semester_code: semesterCode });
    fail(error);
    return groupFriendSchedule((data ?? []) as FriendScheduleRow[]);
  }

  async listMarketPosts() {
    const { data, error } = await this.db.from('market_posts').select(POST_COLS).order('created_at', { ascending: false }).limit(200);
    fail(error);
    return ((data ?? []) as unknown as PostRow[]).map(mapPost);
  }

  async getMarketPost(id: string) {
    const { data, error } = await this.db.from('market_posts').select(POST_COLS).eq('id', id).maybeSingle();
    fail(error);
    return data ? mapPost(data as unknown as PostRow) : null;
  }

  async createMarketPost(input: MarketPostInput) {
    const { data, error } = await this.db.from('market_posts').insert({
      kind: input.kind, category: input.category, title: input.title.trim(), description: input.description.trim(),
      price: input.price, course_code: input.courseCode?.trim().toUpperCase() || null, condition: input.condition,
      photos: (input.photos ?? []).slice(0, 4),
    }).select(POST_COLS).single();
    fail(error);
    return mapPost(data as unknown as PostRow);
  }

  async updateMarketPost(id: string, patch: Partial<MarketPostInput & { status: MarketStatus }>) {
    const row: Record<string, unknown> = {};
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.description !== undefined) row.description = patch.description.trim();
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.courseCode !== undefined) row.course_code = patch.courseCode?.trim().toUpperCase() || null;
    if (patch.condition !== undefined) row.condition = patch.condition;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.photos !== undefined) row.photos = patch.photos.slice(0, 4);
    const { data, error } = await this.db.from('market_posts').update(row).eq('id', id).select(POST_COLS).single();
    fail(error);
    return mapPost(data as unknown as PostRow);
  }

  async uploadMarketPhoto(photo: Blob) {
    const path = `${this.userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.db.storage.from('market-photos').upload(path, photo, { contentType: 'image/jpeg', upsert: false });
    fail(error);
    return this.db.storage.from('market-photos').getPublicUrl(path).data.publicUrl;
  }

  /** Removes photos from this user's own folder; URLs of other users are ignored. */
  async removeMarketPhotos(urls: string[]) {
    const marker = `/market-photos/${this.userId}/`;
    const paths = urls.filter((u) => u.includes(marker)).map((u) => `${this.userId}/${u.split(marker)[1]!.split('?')[0]}`);
    if (paths.length) fail((await this.db.storage.from('market-photos').remove(paths)).error);
  }

  /** Removes every photo this user uploaded, including ones no post refers to any more. */
  async removeAllMyPhotos() {
    const bucket = this.db.storage.from('market-photos');
    for (;;) {
      const { data, error } = await bucket.list(this.userId, { limit: 100 });
      fail(error);
      if (!data?.length) return;
      fail((await bucket.remove(data.map((f) => `${this.userId}/${f.name}`))).error);
    }
  }

  async deleteMarketPost(id: string) {
    const post = await this.getMarketPost(id);
    fail((await this.db.from('market_posts').delete().eq('id', id)).error);
    if (post?.photos.length) await this.removeMarketPhotos(post.photos);
  }

  async listComments(postId: string) {
    const { data, error } = await this.db.from('market_comments').select('id, post_id, user_id, author_name, body, created_at').eq('post_id', postId).order('created_at');
    fail(error);
    return ((data ?? []) as CommentRow[]).map(mapComment);
  }

  async addComment(postId: string, body: string) {
    const { data, error } = await this.db.from('market_comments').insert({ post_id: postId, body: body.trim() }).select('id, post_id, user_id, author_name, body, created_at').single();
    fail(error);
    return mapComment(data as CommentRow);
  }

  async deleteComment(id: string) {
    fail((await this.db.from('market_comments').delete().eq('id', id)).error);
  }

  async report(target: ReportTarget, reason: ReportReason, note?: string) {
    const clean = note?.trim() || null;
    const { error } = target.type === 'post'
      ? await this.db.from('market_reports').insert({ post_id: target.id, reason, note: clean })
      : await this.db.from('content_reports').insert({ target_type: target.type, target_id: target.id, reason, note: clean });
    fail(error);
  }

  async hasAcceptedRules(version: number) {
    const { data, error } = await this.db.from('market_rule_acceptances').select('version').eq('user_id', this.userId).maybeSingle();
    fail(error);
    return Boolean(data && (data as { version: number }).version >= version);
  }

  async acceptRules(version: number) {
    fail((await this.db.rpc('accept_market_rules', { rules_version: version })).error);
  }

  async blockUser(userId: string) {
    fail((await this.db.rpc('block_user', { target: userId })).error);
  }

  async unblockUser(userId: string) {
    fail((await this.db.from('user_blocks').delete().eq('blocker', this.userId).eq('blocked', userId)).error);
  }

  async listBlocked(): Promise<BlockedUser[]> {
    const { data, error } = await this.db.from('user_blocks').select('blocked, blocked_name').eq('blocker', this.userId).order('created_at');
    fail(error);
    return ((data ?? []) as { blocked: string; blocked_name: string }[]).map((r) => ({ userId: r.blocked, displayName: r.blocked_name }));
  }
}
