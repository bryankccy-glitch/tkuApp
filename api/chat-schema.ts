import { z } from 'zod';

const timezoneSchema = z.string().min(1).max(100).refine((timezone) => {
  try {
    new Intl.DateTimeFormat('zh-TW', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}, 'timezone 必須是有效的 IANA 時區');

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, '訊息不可為空').max(1000, '訊息不可超過 1000 字'),
  conversationId: z.string().uuid().nullable(),
  semesterId: z.string().uuid().optional(),
  lang: z.enum(['zh-TW', 'en']).optional(),
  timezone: timezoneSchema,
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000),
  })).max(8, 'history 最多 8 則'),
}).strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type SourceRef = {
  title: string;
  publisher?: string;
  url?: string;
  updated?: string;
  kind: 'official' | 'personal' | 'campus';
};
