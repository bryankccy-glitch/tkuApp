import { useCallback, useEffect, useRef, useState } from 'react';
import { useSemester } from '@/app/SemesterProvider';
import { useAuth } from '@/app/AuthProvider';
import { useCourses, useTasks } from '@/lib/hooks';
import { useCampusEvents } from '@/lib/events';
import { uid } from '@/lib/id';
import { answerLocally } from './localEngine';
import { t } from '@/i18n/t';
import i18n, { prepareLanguage, withLanguage } from '@/i18n';
import { detectLanguage, toEngineQuestion } from './questionLanguage';
import type { ChatMessage } from './types';

const LEGACY_KEY = 'tku.chat.v1';
const MAX_HISTORY = 60;

function load(key: string): ChatMessage[] {
  try {
    // The shared history has no known owner, so discard it without reading it.
    localStorage.removeItem(LEGACY_KEY);
    return JSON.parse(localStorage.getItem(key) ?? '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

/**
 * The campus assistant runs entirely on the device (`localEngine`): no AI service, no API key,
 * nothing uploaded. Answers come from the user's own schedule / tasks and verified campus data.
 */
export function useChat() {
  const { session } = useAuth();
  const key = `tku.chat.v2:${session?.user.id ?? 'guest'}`;
  const { semester } = useSemester();
  const { data: courses = [] } = useCourses(semester?.id);
  const { data: tasks = [] } = useTasks();
  const { data: events = null } = useCampusEvents();
  const [messages, setMessages] = useState<ChatMessage[]>(() => load(key));
  const [historyKey, setHistoryKey] = useState(key);
  const [busy, setBusy] = useState(false);
  const stopped = useRef(false);

  // Reset before committing so the previous identity is never displayed or persisted
  // under the new identity's key.
  if (historyKey !== key) {
    setHistoryKey(key);
    setMessages(load(key));
  }

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages.filter((m) => !m.error).slice(-MAX_HISTORY)));
    } catch {
      /* ignore */
    }
  }, [key, messages]);

  const patch = (id: string, fn: (m: ChatMessage) => ChatMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(
    /** `asked` is what the engine reads when it differs from what is shown (quick questions in other languages). */
    async (text: string, asked?: string) => {
      const question = text.trim().slice(0, 1000);
      if (!question || busy) return;
      const user: ChatMessage = { id: uid(), role: 'user', content: question, ...(asked ? { asked } : {}) };
      const reply: ChatMessage = { id: uid(), role: 'assistant', content: '' };
      stopped.current = false;
      setMessages((ms) => [...ms.filter((m) => !m.error), user, reply]);
      setBusy(true);
      try {
        // Answer in the language of the question as written, not the language of the interface.
        const asks = detectLanguage(question, i18n.language, courses);
        const language = await prepareLanguage(asks).then(() => asks, () => i18n.language);
        const engineQuestion = asked ?? toEngineQuestion(question, language);
        const ans = withLanguage(language, () => answerLocally({ question: engineQuestion, courses, tasks, events, now: new Date(), semester }));
        // Reveal progressively so the answer reads like it is being typed.
        const chars = [...ans.content];
        for (let i = 0; i < chars.length && !stopped.current; i += 6) {
          await new Promise((r) => setTimeout(r, 12));
          patch(reply.id, (m) => ({ ...m, content: chars.slice(0, i + 6).join('') }));
        }
        patch(reply.id, (m) => ({ ...m, content: stopped.current ? m.content || t('ai.stopped') : ans.content, sources: ans.sources, engine: 'local' }));
      } catch {
        patch(reply.id, (m) => ({ ...m, error: true, content: t('ai.error') }));
      } finally {
        setBusy(false);
      }
    },
    [busy, courses, tasks, events, semester],
  );

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((ms) => ms.slice(0, ms.lastIndexOf(lastUser)));
    setTimeout(() => send(lastUser.content, lastUser.asked), 0);
  }, [messages, send]);

  const stop = () => { stopped.current = true; };
  const clear = () => setMessages([]);

  return { messages, busy, send, retry, stop, clear };
}
