import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CAMPUS_PLACES } from '../../src/data/places.js';
import { OFFICIAL_SOURCES } from '../../src/data/sources.js';
import type { SourceRef } from './chat-schema.js';

export type ServerEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  rateLimitPerMinute: number;
};

export type ToolName =
  | 'getTodaySchedule'
  | 'getCourseDetails'
  | 'getUpcomingTasks'
  | 'searchCampusPlaces'
  | 'searchCampusEvents'
  | 'searchUniversityKnowledge';

export type ToolResult = { data: unknown; sources: SourceRef[] };

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  instructor: string | null;
  semester_id: string;
  notes: string | null;
  schedule_entries?: Array<{ weekday: number; start_time: string; end_time: string; room: string }>;
};

type ScheduleRow = {
  weekday: number;
  start_time: string;
  end_time: string;
  room: string;
  user_courses: CourseRow | CourseRow[] | null;
};

type TaskRow = {
  title: string;
  description: string | null;
  kind: string;
  due_at: string;
  priority: string;
  user_courses: { name: string } | Array<{ name: string }> | null;
};

type EventRow = {
  title: string;
  summary: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  organizer: string;
  source_name: string;
  source_url: string;
  registration_url: string | null;
};

type KnowledgeRow = {
  content: string;
  similarity: number;
  title: string;
  publisher: string;
  source_url: string;
  source_updated_at: string | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function assertNoError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function weekdayInTimezone(date: Date, timezone: string): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[label] ?? 1;
}

function normalizeQuery(value: unknown, max = 100): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeFilterText(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function personalSource(title: string): SourceRef {
  return { title, publisher: '你的 TKU Campus OS 資料', kind: 'personal' };
}

export class CampusStore {
  private readonly userClient: SupabaseClient;
  private readonly serviceClient: SupabaseClient;

  constructor(
    private readonly env: ServerEnv,
    private readonly token: string,
    private readonly embed: (text: string) => Promise<number[]>,
  ) {
    const common = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    this.userClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      ...common,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    this.serviceClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, common);
  }

  async authenticate(): Promise<string | null> {
    const { data, error } = await this.userClient.auth.getUser(this.token);
    if (error || !data.user) return null;
    return data.user.id;
  }

  async recordAndCheckRateLimit(userId: string, now: Date): Promise<boolean> {
    const { error: insertError } = await this.serviceClient.from('ai_usage').insert({ user_id: userId });
    assertNoError(insertError, '無法記錄 AI 使用量');

    const since = new Date(now.getTime() - 60_000).toISOString();
    const { count, error } = await this.serviceClient
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    assertNoError(error, '無法檢查 AI 使用量');
    return (count ?? 0) <= this.env.rateLimitPerMinute;
  }

  async getOrCreateConversation(userId: string, conversationId: string | null, message: string): Promise<string> {
    if (conversationId) {
      const { data, error } = await this.userClient
        .from('ai_conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle();
      assertNoError(error, '無法讀取對話');
      if (!data) throw new InvalidConversationError();
      return data.id as string;
    }

    const { data, error } = await this.userClient
      .from('ai_conversations')
      .insert({ user_id: userId, title: message.slice(0, 40) })
      .select('id')
      .single();
    assertNoError(error, '無法建立對話');
    if (!data) throw new Error('無法建立對話：資料庫沒有回傳對話 ID');
    return data.id as string;
  }

  async insertMessage(userId: string, conversationId: string, role: 'user' | 'assistant', content: string, sources: SourceRef[] = []): Promise<void> {
    const { error } = await this.userClient.from('ai_messages').insert({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
      sources,
    });
    assertNoError(error, '無法儲存對話訊息');
  }

  async executeTool(name: ToolName, args: Record<string, unknown>, context: { semesterId?: string; timezone: string; now: Date }): Promise<ToolResult> {
    switch (name) {
      case 'getTodaySchedule':
        return this.getTodaySchedule(context);
      case 'getCourseDetails':
        return this.getCourseDetails(normalizeQuery(args.query), context.semesterId);
      case 'getUpcomingTasks':
        return this.getUpcomingTasks(context.now);
      case 'searchCampusPlaces':
        return this.searchCampusPlaces(normalizeQuery(args.query));
      case 'searchCampusEvents':
        return this.searchCampusEvents(normalizeQuery(args.query), context.now);
      case 'searchUniversityKnowledge':
        return this.searchUniversityKnowledge(normalizeQuery(args.query, 500));
    }
  }

  private async getTodaySchedule(context: { semesterId?: string; timezone: string; now: Date }): Promise<ToolResult> {
    let query = this.userClient
      .from('schedule_entries')
      .select('weekday,start_time,end_time,room,user_courses!inner(id,name,code,instructor,semester_id)')
      .eq('weekday', weekdayInTimezone(context.now, context.timezone))
      .order('start_time');
    if (context.semesterId) query = query.eq('user_courses.semester_id', context.semesterId);
    const { data, error } = await query;
    assertNoError(error, '無法讀取今日課表');
    const rows = (data ?? []) as unknown as ScheduleRow[];
    return {
      data: rows.map((row) => ({ ...row, user_courses: firstRelation(row.user_courses) })),
      sources: [personalSource('我的今日課表')],
    };
  }

  private async getCourseDetails(queryText: string, semesterId?: string): Promise<ToolResult> {
    if (!queryText) return { data: [], sources: [personalSource('我的課程資料')] };
    const safe = safeFilterText(queryText);
    let query = this.userClient
      .from('user_courses')
      .select('id,name,code,instructor,semester_id,notes,schedule_entries(weekday,start_time,end_time,room)')
      .or(`name.ilike.%${safe}%,code.ilike.%${safe}%`)
      .limit(8);
    if (semesterId) query = query.eq('semester_id', semesterId);
    const { data, error } = await query;
    assertNoError(error, '無法讀取課程資料');
    return { data: (data ?? []) as unknown as CourseRow[], sources: [personalSource('我的課程資料')] };
  }

  private async getUpcomingTasks(now: Date): Promise<ToolResult> {
    const { data, error } = await this.userClient
      .from('tasks')
      .select('title,description,kind,due_at,priority,user_courses(name)')
      .eq('completed', false)
      .gte('due_at', now.toISOString())
      .order('due_at')
      .limit(20);
    assertNoError(error, '無法讀取待辦');
    const rows = (data ?? []) as unknown as TaskRow[];
    return {
      data: rows.map((row) => ({ ...row, user_courses: firstRelation(row.user_courses) })),
      sources: [personalSource('我的待辦事項')],
    };
  }

  private searchCampusPlaces(queryText: string): ToolResult {
    const lowered = queryText.toLocaleLowerCase('zh-Hant-TW');
    const matches = CAMPUS_PLACES.filter((place) =>
      !lowered || [place.code, place.name, place.note ?? ''].some((value) => value.toLocaleLowerCase('zh-Hant-TW').includes(lowered)),
    ).slice(0, 10);
    const sources = [...new Map(matches.map((place) => [place.source.url, {
      title: place.source.name,
      url: place.source.url,
      kind: 'campus' as const,
    }])).values()];
    return { data: matches, sources };
  }

  private async searchCampusEvents(queryText: string, now: Date): Promise<ToolResult> {
    let query = this.userClient
      .from('campus_events')
      .select('title,summary,starts_at,ends_at,location,organizer,source_name,source_url,registration_url')
      .eq('status', 'published')
      .gte('starts_at', new Date(now.getTime() - 86_400_000).toISOString())
      .order('starts_at')
      .limit(10);
    if (queryText) {
      const safe = safeFilterText(queryText);
      query = query.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%,organizer.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    assertNoError(error, '無法讀取校園活動');
    const rows = (data ?? []) as unknown as EventRow[];
    return {
      data: rows,
      sources: [...new Map(rows.map((event) => [event.source_url, {
        title: event.title,
        publisher: event.source_name,
        url: event.source_url,
        kind: 'campus' as const,
      }])).values()],
    };
  }

  private async searchUniversityKnowledge(queryText: string): Promise<ToolResult> {
    const fallbackSources = OFFICIAL_SOURCES
      .filter((source) => source.keywords.some((keyword) => queryText.includes(keyword)))
      .slice(0, 3)
      .map((source) => ({
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        ...(source.updated ? { updated: source.updated } : {}),
        kind: 'official' as const,
      }));
    if (!queryText) return { data: [], sources: fallbackSources };
    const embedding = await this.embed(queryText);
    const { data, error } = await this.serviceClient.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_count: 6,
      min_similarity: 0.75,
    });
    assertNoError(error, '無法搜尋校方知識庫');
    const rows = (data ?? []) as unknown as KnowledgeRow[];
    const matchedSources = [...new Map(rows.map((row) => [row.source_url, {
      title: row.title,
      publisher: row.publisher,
      url: row.source_url,
      ...(row.source_updated_at ? { updated: row.source_updated_at } : {}),
      kind: 'official' as const,
    }])).values()];
    return {
      data: {
        documents: rows,
        officialFallbackLinks: rows.length > 0 ? [] : fallbackSources.length > 0 ? fallbackSources : [{
          title: '淡江大學官方網站',
          publisher: '淡江大學',
          url: 'https://www.tku.edu.tw/',
        }],
      },
      sources: matchedSources.length > 0 ? matchedSources : fallbackSources.length > 0 ? fallbackSources : [{
        title: '淡江大學官方網站',
        publisher: '淡江大學',
        url: 'https://www.tku.edu.tw/',
        kind: 'official',
      }],
    };
  }
}

export class InvalidConversationError extends Error {
  constructor() {
    super('找不到這個對話，或你沒有存取權限。');
    this.name = 'InvalidConversationError';
  }
}
