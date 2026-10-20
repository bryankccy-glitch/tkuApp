import type { Course } from '../types';

export type FriendDirection = 'friend' | 'incoming' | 'outgoing';

export interface FriendEntry {
  friendshipId: string;
  friendId: string;
  displayName: string;
  department?: string;
  direction: FriendDirection;
  createdAt: string;
}

export type FriendRequestResult = 'sent' | 'accepted' | 'already_friends' | 'pending' | 'self' | 'not_found';

export const MARKET_KINDS = ['sell', 'want'] as const;
export type MarketKind = (typeof MARKET_KINDS)[number];
export const MARKET_CATEGORIES = ['book', 'stationery', 'electronics', 'daily', 'other'] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export const MARKET_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type MarketCondition = (typeof MARKET_CONDITIONS)[number];
export const MARKET_STATUSES = ['open', 'reserved', 'closed'] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];
export const REPORT_REASONS = ['prohibited', 'scam', 'spam', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface MarketPost {
  id: string;
  userId: string;
  authorName: string;
  kind: MarketKind;
  category: MarketCategory;
  title: string;
  description: string;
  /** Reference price in NT$; the platform never handles payment. */
  price: number | null;
  courseCode: string | null;
  condition: MarketCondition | null;
  status: MarketStatus;
  /** Public image URLs (market-photos bucket), at most 4. */
  photos: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type MarketPostInput = Pick<MarketPost, 'kind' | 'category' | 'title' | 'description' | 'price' | 'courseCode' | 'condition'> & { photos?: string[] };

export interface MarketComment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/**
 * Features that only exist with an account (cloud mode). Every call runs with the user's JWT;
 * friend operations go through SECURITY DEFINER RPCs, market tables are protected by RLS.
 */
export interface SocialApi {
  readonly userId: string;

  getFriendCode(): Promise<string>;
  regenerateFriendCode(): Promise<string>;
  listFriends(): Promise<FriendEntry[]>;
  sendFriendRequest(code: string): Promise<FriendRequestResult>;
  respondFriendRequest(friendshipId: string, accept: boolean): Promise<void>;
  removeFriendship(friendshipId: string): Promise<void>;
  /** Friend's courses in the semester with this code (e.g. "115-1"). Private notes are never included. */
  getFriendSchedule(friendId: string, semesterCode: string): Promise<Course[]>;

  listMarketPosts(): Promise<MarketPost[]>;
  getMarketPost(id: string): Promise<MarketPost | null>;
  createMarketPost(input: MarketPostInput): Promise<MarketPost>;
  updateMarketPost(id: string, patch: Partial<MarketPostInput & { status: MarketStatus }>): Promise<MarketPost>;
  deleteMarketPost(id: string): Promise<void>;
  /** Uploads one (already downscaled) JPEG and returns its public URL. */
  uploadMarketPhoto(photo: Blob): Promise<string>;
  listComments(postId: string): Promise<MarketComment[]>;
  addComment(postId: string, body: string): Promise<MarketComment>;
  deleteComment(id: string): Promise<void>;
  reportPost(postId: string, reason: ReportReason, note?: string): Promise<void>;
}
