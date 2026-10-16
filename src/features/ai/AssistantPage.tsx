import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Check, Copy, ExternalLink, FileText, RotateCcw, Square, Trash2, UserRound, MapPin } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useChat } from './useChat';
import type { ChatMessage, SourceRef } from './types';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

const QUICK = [1, 2, 3, 4, 5, 6].map((i) => `ai.quick.${i}`);

function SourceCard({ s }: { s: SourceRef }) {
  const Icon = s.kind === 'personal' ? UserRound : s.kind === 'campus' ? MapPin : FileText;
  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-caption font-semibold text-ink">{s.title}</span>
        <span className="block truncate text-[11px] text-muted">
          {s.kind === 'personal' ? t('ai.yourData') : [s.publisher, s.updated].filter(Boolean).join('｜') || (s.url ? new URL(s.url).hostname : '')}
        </span>
      </span>
      {s.url && <ExternalLink className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
    </>
  );
  return s.url ? (
    <a href={s.url} target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 rounded-sm border border-line bg-surface px-3 py-2 hover:border-primary/40">{body}</a>
  ) : (
    <div className="flex items-start gap-2 rounded-sm border border-line bg-surface px-3 py-2">{body}</div>
  );
}

function Message({ m, last, busy, onRetry }: { m: ChatMessage; last: boolean; busy: boolean; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-xs bg-primary px-4 py-2.5 text-body text-white dark:text-[#1A0506]">{m.content}</p>
      </div>
    );
  }
  const streaming = last && busy;
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7" title={t('ai.avatar')} />
      <div className="min-w-0 flex-1">
        {m.error ? (
          <div role="alert" className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2.5 text-body">
            <p className="text-ink">{m.content}</p>
            <button type="button" onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 text-caption font-semibold text-link hover:underline"><RotateCcw className="h-3.5 w-3.5" />{t('ai.retry')}</button>
          </div>
        ) : m.content === '' && streaming ? (
          <p className="flex items-center gap-1.5 py-2 text-caption text-muted" role="status">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-heritage motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
            </span>
            {t('ai.searching')}
          </p>
        ) : (
          <div className="prose-chat text-body text-ink">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-link underline underline-offset-2">{children}</a>,
                ul: ({ children }) => <ul className="my-2 space-y-1 pl-1">{children}</ul>,
                li: ({ children }) => <li className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-heritage">{children}</li>,
                p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
              }}
            >
              {m.content}
            </ReactMarkdown>
            {streaming && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-ink motion-safe:animate-[caret_1s_steps(1)_infinite]" aria-hidden />}
          </div>
        )}
        {!streaming && !m.error && m.sources && m.sources.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-muted">{t('ai.sources')}</p>
            <div className="mt-1 grid gap-1.5">{m.sources.map((s, i) => <SourceCard key={i} s={s} />)}</div>
          </div>
        )}
        {!streaming && !m.error && m.content && (
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
            <button
              type="button"
              onClick={async () => { try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
              className="inline-flex items-center gap-1 rounded-xs py-1 hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? t('ai.copied') : t('ai.copy')}
            </button>
            {m.engine === 'local' && <span>{t('ai.localNote')}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const { messages, busy, send, retry, stop, clear, mode } = useChat();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handled = useRef(false);

  useEffect(() => {
    const q = params.get('q');
    if (q && !handled.current) {
      handled.current = true;
      setParams({}, { replace: true });
      send(q);
    }
  }, [params, send, setParams]);

  // Chat-app layout: a fixed layer sized to the visible screen. Header stays on top, messages scroll
  // in between, the composer sits on the bottom nav — or right on the keyboard while typing.
  const viewport = useVisualViewport();
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typing) document.documentElement.dataset.kb = 'open';
    else delete document.documentElement.dataset.kb;
    return () => { delete document.documentElement.dataset.kb; };
  }, [typing]);
  // iOS may still scroll the page when the field gets focus; the layer follows the visible area,
  // so put the page itself back to the top to avoid a stray offset after the keyboard closes.
  useEffect(() => {
    if (!typing) window.scrollTo(0, 0);
  }, [typing]);
  // The chat scrolls inside its own list; the page behind it must not scroll or bounce.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = prev; };
  }, []);

  const scrollToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  // Follow new messages and keep the latest in view when the visible area shrinks (keyboard).
  useEffect(() => {
    if (messages.length) scrollToEnd();
  }, [messages, viewport?.height]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Empty: let rows={1} decide (measuring an empty field can count a wrapped placeholder).
    if (!text) { el.style.height = ''; return; }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = () => {
    if (!text.trim() || busy) return;
    send(text);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="fixed left-1/2 z-20 flex w-full max-w-app -translate-x-1/2 flex-col bg-canvas"
      style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line/60 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div>
          <h1 className="text-h2 text-ink">{t('ai.title')}</h1>
          <p className={cn('mt-0.5 text-caption text-muted', typing && 'hidden')}>
            {mode === 'cloud' ? t('ai.cloudHint') : t('ai.localHint')}
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-caption font-semibold text-muted hover:bg-sunken hover:text-ink">
            <Trash2 className="h-4 w-4" />{t('ai.clear')}
          </button>
        )}
      </header>

      <div ref={listRef} data-keep-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [-webkit-overflow-scrolling:touch]" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-start">
            <p className="text-h3 text-ink">{t('ai.emptyTitle')}</p>
            <p className="mt-1 text-caption text-muted">{t('ai.emptyBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK.map((k) => t(k)).map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-caption font-medium text-ink hover:border-primary/40">{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {messages.map((m, i) => <Message key={m.id} m={m} last={i === messages.length - 1} busy={busy} onRetry={retry} />)}
          </div>
        )}
      </div>

      {/* Composer: on top of the bottom nav normally; the nav hides while typing so it sits on the keyboard. */}
      <div className={cn('shrink-0 border-t border-line/60 bg-canvas px-3 pt-2', typing ? 'pb-2' : 'pb-[calc(5.25rem+var(--safe-bottom))]')}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2 rounded-lg border border-line bg-surface p-2 shadow-lift focus-within:border-link">
          <label htmlFor="chat-input" className="sr-only">{t('ai.inputLabel')}</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder={t('ai.placeholder')}
            enterKeyHint="send"
            className="max-h-36 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-body text-ink placeholder:text-muted focus:outline-none"
          />
          {busy ? (
            <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={stop} aria-label={t('ai.stop')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ink text-canvas"><Square className="h-4 w-4" /></button>
          ) : (
            <button type="submit" onPointerDown={(e) => e.preventDefault()} aria-label={t('ai.send')} disabled={!text.trim()} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-heritage text-white transition-opacity disabled:opacity-35')}>
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </form>
        {!typing && <p className="mt-1 text-center text-[11px] text-muted">{t('ai.disclaimer')}</p>}
      </div>

      <ConfirmSheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t('ai.clearTitle')} message={t('ai.clearBody')} confirmLabel={t('ai.clearConfirm')} onConfirm={() => { clear(); setConfirmClear(false); }} />
    </div>
  );
}
