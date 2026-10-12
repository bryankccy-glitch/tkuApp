import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/AuthProvider';
import { useSemester } from '@/app/SemesterProvider';
import { useCourses, useTasks } from '@/lib/hooks';
import { useCampusEvents } from '@/lib/events';
import { uid } from '@/lib/id';
import { answerLocally } from './localEngine';
import { t } from '@/i18n/t';
import i18n from '@/i18n';
import type { ChatMessage, SourceRef } from './types';

const KEY = 'tku.chat.v1';
const MAX_HISTORY = 60;

function load(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

export function useChat() {
  const { mode, session } = useAuth();
  const { semester } = useSemester();
  const { data: courses = [] } = useCourses(semester?.id);
  const { data: tasks = [] } = useTasks();
  const { data: events = null } = useCampusEvents();
  const [messages, setMessages] = useState<ChatMessage[]>(load);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const conversationId = useRef<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(messages.filter((m) => !m.error).slice(-MAX_HISTORY)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  const patch = (id: string, fn: (m: ChatMessage) => ChatMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const runLocal = useCallback(
    async (question: string, id: string) => {
      const ans = answerLocally({ question, courses, tasks, events, now: new Date() });
      // Reveal progressively so the UI behaves like a stream.
      const chars = [...ans.content];
      for (let i = 0; i < chars.length; i += 6) {
        await new Promise((r) => setTimeout(r, 12));
        patch(id, (m) => ({ ...m, content: chars.slice(0, i + 6).join('') }));
      }
      patch(id, (m) => ({ ...m, content: ans.content, sources: ans.sources, engine: 'local' }));
    },
    [courses, tasks, events],
  );

  const runCloud = useCallback(async (question: string, id: string, history: ChatMessage[]) => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    const res = await fetch('/api/chat', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        message: question,
        conversationId: conversationId.current,
        semesterId: semester?.id,
        // Answer language follows the UI; campus times are always Taipei time.
        lang: i18n.language === 'en' ? 'en' : 'zh-TW',
        timezone: 'Asia/Taipei',
        // The API rejects empty turns (e.g. a stopped reply), so drop them.
        history: history.filter((m) => !m.error && m.content.trim()).slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      }),
    });
    // 503 = server AI not configured; 404 / non-SSE = API not deployed yet (e.g. vite dev). Fall back to local engine.
    if (res.status === 503 || res.status === 404 || (res.ok && !res.headers.get('content-type')?.includes('text/event-stream'))) return 'unavailable' as const;
    if (res.status === 429) throw new Error(t('ai.rateLimited'));
    if (!res.ok || !res.body) throw new Error(t('ai.unavailable', { status: res.status }));
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop() ?? '';
      for (const ev of events) {
        const line = ev.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        const data = JSON.parse(line.slice(6)) as { type: string; text?: string; sources?: SourceRef[]; message?: string; conversationId?: string };
        if (data.type === 'meta' && data.conversationId) conversationId.current = data.conversationId;
        if (data.type === 'delta' && data.text) patch(id, (m) => ({ ...m, content: m.content + data.text }));
        if (data.type === 'sources') patch(id, (m) => ({ ...m, sources: data.sources }));
        if (data.type === 'error') throw new Error(data.message ?? t('ai.error'));
      }
    }
    patch(id, (m) => ({ ...m, engine: 'cloud' }));
    return 'ok' as const;
  }, [session, semester]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, 1000);
      if (!question || busy) return;
      const user: ChatMessage = { id: uid(), role: 'user', content: question };
      const reply: ChatMessage = { id: uid(), role: 'assistant', content: '' };
      const history = messages;
      setMessages((ms) => [...ms.filter((m) => !m.error), user, reply]);
      setBusy(true);
      try {
        if (mode === 'cloud') {
          const r = await runCloud(question, reply.id, history);
          if (r === 'unavailable') await runLocal(question, reply.id);
        } else {
          await runLocal(question, reply.id);
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          patch(reply.id, (m) => ({ ...m, content: m.content || t('ai.stopped') }));
        } else {
          patch(reply.id, (m) => ({ ...m, error: true, content: e instanceof Error ? e.message : t('ai.error') }));
        }
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, messages, mode, runCloud, runLocal],
  );

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((ms) => {
      const idx = ms.lastIndexOf(lastUser);
      return ms.slice(0, idx);
    });
    setTimeout(() => send(lastUser.content), 0);
  }, [messages, send]);

  const stop = () => abort.current?.abort();
  const clear = () => {
    setMessages([]);
    conversationId.current = null;
  };

  return { messages, busy, send, retry, stop, clear, mode };
}
