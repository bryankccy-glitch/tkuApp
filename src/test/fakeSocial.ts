import type { Course } from '@/lib/types';
import type { BlockedUser, ReportTarget, FriendEntry, FriendRequestResult, MarketComment, MarketPost, MarketPostInput, MarketStatus, ReportReason, SocialApi } from '@/lib/social/types';
import { LocalRepository } from '@/lib/data/local';
import { memoryStorage } from './memoryStorage';

/** In-memory SocialApi for component tests (mirrors the server rules that matter to the UI). */
export class FakeSocial implements SocialApi {
  readonly userId = 'me';
  code = 'MYCODE23';
  friends: FriendEntry[] = [];
  schedules = new Map<string, Course[]>();
  posts: MarketPost[] = [];
  comments: MarketComment[] = [];
  reports: { postId: string; type: string; reason: ReportReason; note?: string }[] = [];
  blocked: BlockedUser[] = [];
  rulesAccepted = true;
  removedPhotos: string[] = [];
  codes = new Map<string, { id: string; name: string }>();
  private n = 0;
  private id(p: string) { this.n += 1; return `${p}${this.n}`; }

  async getFriendCode() { return this.code; }
  async regenerateFriendCode() { this.code = 'NEWCODE9'; return this.code; }
  async listFriends() { return [...this.friends]; }
  async sendFriendRequest(code: string): Promise<FriendRequestResult> {
    if (code === this.code) return 'self';
    const who = this.codes.get(code);
    if (!who) return 'not_found';
    const existing = this.friends.find((f) => f.friendId === who.id);
    if (existing) return existing.direction === 'friend' ? 'already_friends' : 'pending';
    this.friends.push({ friendshipId: this.id('f'), friendId: who.id, displayName: who.name, direction: 'outgoing', createdAt: new Date().toISOString() });
    return 'sent';
  }
  async respondFriendRequest(id: string, accept: boolean) {
    const f = this.friends.find((x) => x.friendshipId === id && x.direction === 'incoming');
    if (!f) throw new Error('request not found');
    if (accept) f.direction = 'friend'; else this.friends = this.friends.filter((x) => x !== f);
  }
  async removeFriendship(id: string) { this.friends = this.friends.filter((x) => x.friendshipId !== id); }
  async getFriendSchedule(friendId: string) {
    return this.friends.some((f) => f.friendId === friendId && f.direction === 'friend') ? (this.schedules.get(friendId) ?? []) : [];
  }

  async listMarketPosts() {
    return this.posts.map((p) => ({ ...p, commentCount: this.comments.filter((c) => c.postId === p.id).length }));
  }
  async getMarketPost(id: string) { return (await this.listMarketPosts()).find((p) => p.id === id) ?? null; }
  async createMarketPost(input: MarketPostInput) {
    const now = new Date().toISOString();
    const post: MarketPost = { ...input, photos: input.photos ?? [], id: this.id('p'), userId: this.userId, authorName: '我', status: 'open', commentCount: 0, createdAt: now, updatedAt: now };
    this.posts.unshift(post);
    return post;
  }
  async updateMarketPost(id: string, patch: Partial<MarketPostInput & { status: MarketStatus }>) {
    const p = this.posts.find((x) => x.id === id);
    if (!p || p.userId !== this.userId) throw new Error('not found');
    Object.assign(p, patch);
    return p;
  }
  async uploadMarketPhoto(_photo: Blob) {
    return `https://example.supabase.co/storage/v1/object/public/market-photos/${this.id('img')}.jpg`;
  }

  async deleteMarketPost(id: string) { this.posts = this.posts.filter((p) => p.id !== id); }
  async listComments(postId: string) { return this.comments.filter((c) => c.postId === postId); }
  async addComment(postId: string, body: string) {
    const c: MarketComment = { id: this.id('c'), postId, userId: this.userId, authorName: '我', body, createdAt: new Date().toISOString() };
    this.comments.push(c);
    return c;
  }
  async deleteComment(id: string) { this.comments = this.comments.filter((c) => c.id !== id); }
  async report(target: ReportTarget, reason: ReportReason, note?: string) { this.reports.push({ postId: target.id, type: target.type, reason, note }); }
  async removeMarketPhotos(urls: string[]) { this.removedPhotos.push(...urls); }
  async removeAllMyPhotos() { /* nothing stored */ }
  async hasAcceptedRules() { return this.rulesAccepted; }
  async acceptRules() { this.rulesAccepted = true; }
  async blockUser(userId: string) { this.blocked.push({ userId, displayName: userId }); this.posts = this.posts.filter((p) => p.userId !== userId); this.comments = this.comments.filter((c) => c.userId !== userId); }
  async unblockUser(userId: string) { this.blocked = this.blocked.filter((b) => b.userId !== userId); }
  async listBlocked() { return this.blocked; }
}

/** A local repository that also exposes a fake social API, as if signed in. */
export function repoWithSocial(social = new FakeSocial()) {
  const repo = new LocalRepository(memoryStorage());
  (repo as { social: SocialApi | null }).social = social;
  return { repo, social };
}
