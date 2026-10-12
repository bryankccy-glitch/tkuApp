import type { VercelResponse } from '@vercel/node';
import type { SourceRef } from './chat-schema.js';

export type SseEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: SourceRef[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

export function formatSse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function startSse(response: VercelResponse, status = 200): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
}

export function sendSseError(response: VercelResponse, status: number, message: string): void {
  startSse(response, status);
  response.write(formatSse({ type: 'error', message }));
  response.end(formatSse({ type: 'done' }));
}
