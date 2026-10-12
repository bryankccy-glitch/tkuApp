import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatRequestSchema, type ChatRequest, type SourceRef } from './chat-schema.js';
import { answerWithTools, createEmbedding } from './openai.js';
import { formatSse, sendSseError, startSse } from './sse.js';
import { CampusStore, InvalidConversationError, type ServerEnv, type ToolName, type ToolResult } from './store.js';

type Store = {
  authenticate(): Promise<string | null>;
  recordAndCheckRateLimit(userId: string, now: Date): Promise<boolean>;
  getOrCreateConversation(userId: string, conversationId: string | null, message: string): Promise<string>;
  insertMessage(userId: string, conversationId: string, role: 'user' | 'assistant', content: string, sources?: SourceRef[]): Promise<void>;
  executeTool(name: ToolName, args: Record<string, unknown>, context: { semesterId?: string; timezone: string; now: Date }): Promise<ToolResult>;
};

type Dependencies = {
  readEnv: () => ServerEnv | null;
  createStore: (env: ServerEnv, token: string) => Store;
  answer: typeof answerWithTools;
  now: () => Date;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv | null {
  const supabaseUrl = source.SUPABASE_URL?.trim();
  const supabaseAnonKey = source.SUPABASE_ANON_KEY?.trim();
  const supabaseServiceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const openaiApiKey = source.OPENAI_API_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !openaiApiKey) return null;
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    openaiApiKey,
    openaiModel: source.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    openaiEmbeddingModel: source.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
    rateLimitPerMinute: positiveInteger(source.AI_RATE_LIMIT_PER_MINUTE, 10),
  };
}

function parseBody(body: unknown): unknown {
  if (typeof body === 'string') return JSON.parse(body) as unknown;
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as unknown;
  return body;
}

function bearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

const defaultDependencies: Dependencies = {
  readEnv: readServerEnv,
  createStore: (env, token) => new CampusStore(env, token, (text) => createEmbedding(env, text)),
  answer: answerWithTools,
  now: () => new Date(),
};

export function createChatHandler(dependencies: Dependencies = defaultDependencies) {
  return async function chatHandler(request: VercelRequest, response: VercelResponse): Promise<void> {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendSseError(response, 405, '此端點只接受 POST 請求。');
      return;
    }

    const env = dependencies.readEnv();
    if (!env) {
      sendSseError(response, 503, 'AI 助理尚未完成伺服器設定，已切換為本機助理。');
      return;
    }

    let input: ChatRequest;
    try {
      const parsed = chatRequestSchema.safeParse(parseBody(request.body));
      if (!parsed.success) {
        sendSseError(response, 400, `輸入格式不正確：${parsed.error.issues[0]?.message ?? '未知錯誤'}`);
        return;
      }
      input = parsed.data;
    } catch {
      sendSseError(response, 400, '輸入必須是有效的 JSON。');
      return;
    }

    const token = bearerToken(request.headers.authorization);
    if (!token) {
      sendSseError(response, 401, '登入資訊無效，請重新登入。');
      return;
    }

    const store = dependencies.createStore(env, token);
    try {
      const userId = await store.authenticate();
      if (!userId) {
        sendSseError(response, 401, '登入資訊無效或已過期，請重新登入。');
        return;
      }

      const now = dependencies.now();
      if (!await store.recordAndCheckRateLimit(userId, now)) {
        sendSseError(response, 429, '提問太頻繁了，請一分鐘後再試。');
        return;
      }

      const conversationId = await store.getOrCreateConversation(userId, input.conversationId, input.message);
      await store.insertMessage(userId, conversationId, 'user', input.message);

      startSse(response);
      response.write(formatSse({ type: 'meta', conversationId }));

      const result = await dependencies.answer({
        env,
        request: input,
        executeTool: (name, args) => store.executeTool(name, args, {
          ...(input.semesterId ? { semesterId: input.semesterId } : {}),
          timezone: input.timezone,
          now,
        }),
        onDelta: (text) => response.write(formatSse({ type: 'delta', text })),
      });

      await store.insertMessage(userId, conversationId, 'assistant', result.text, result.sources);
      response.write(formatSse({ type: 'sources', sources: result.sources }));
      response.end(formatSse({ type: 'done' }));
    } catch (error) {
      const message = error instanceof InvalidConversationError
        ? error.message
        : 'AI 助理暫時無法回應，請稍後再試。';
      if (!response.headersSent) {
        sendSseError(response, error instanceof InvalidConversationError ? 400 : 500, message);
      } else {
        response.write(formatSse({ type: 'error', message }));
        response.end(formatSse({ type: 'done' }));
      }
      console.error('[api/chat]', error instanceof Error ? error.message : error);
    }
  };
}

export default createChatHandler();
