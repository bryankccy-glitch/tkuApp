import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Check, Copy, ExternalLink, FileText, RotateCcw, Square, Trash2, UserRound, MapPin } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useChat } from './useChat';
import type { ChatMessage, SourceRef } from './types';
import { cn } from '@/lib/cn';

const QUICK = ['明天第一堂課在哪裡？', '這週有哪些作業？', '幫我整理接下來的考試', '淡江病假怎麼請？', 'FL105 在哪一棟？', '第 5 節是幾點？'];

function SourceCard({ s }: { s: SourceRef }) {
  const Icon = s.kind === 'personal' ? UserRound : s.kind === 'campus' ? MapPin : FileText;
  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-caption font-semibold text-ink">{s.title}</span>
        <span className="block truncate text-[11px] text-muted">
          {s.kind === 'personal' ? '你的個人資料' : [s.publisher, s.updated].filter(Boolean).join('｜') || (s.url ? new URL(s.url).hostname : '')}
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
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-xs bg-primary px-4 py-2.5 text-body text-white dark:text-[#2A0E0C]">{m.content}</p>
      </div>
    );
  }
  const streaming = last && busy;
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7" title="校園助理" />
      <div className="min-w-0 flex-1">
        {m.error ? (
          <div role="alert" className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2.5 text-body">
            <p className="text-ink">{m.content}</p>
            <button type="button" onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 text-caption font-semibold text-blue hover:underline"><RotateCcw className="h-3.5 w-3.5" />重試</button>
          </div>
        ) : m.content === '' && streaming ? (
          <p className="flex items-center gap-1.5 py-2 text-caption text-muted" role="status">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-heritage motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
            </span>
            正在查詢資料
          </p>
        ) : (
          <div className="prose-chat text-body text-ink">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-blue underline underline-offset-2">{children}</a>,
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
            <p className="text-[11px] font-semibold text-muted">資料來源</p>
            <div className="mt-1 grid gap-1.5 sm:grid-cols-2">{m.sources.map((s, i) => <SourceCard key={i} s={s} />)}</div>
          </div>
        )}
        {!streaming && !m.error && m.content && (
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
            <button
              type="button"
              onClick={async () => { try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
              className="inline-flex items-center gap-1 rounded-xs py-1 hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '已複製' : '複製回答'}
            </button>
            {m.engine === 'local' && <span>本機助理：只使用你的資料與已查核的校園資訊</span>}
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
  const endRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
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
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 pt-5 sm:px-6 lg:min-h-dvh lg:px-10 lg:pt-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">AI 校園助理</h1>
          <p className="mt-1 text-caption text-muted">
            {mode === 'cloud' ? '回答會附上資料來源；資料不足時會直接說明。' : '本機模式：根據你的課表、待辦與已查核的校園資料回答，不會上傳任何內容。'}
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-caption font-semibold text-muted hover:bg-sunken hover:text-ink">
            <Trash2 className="h-4 w-4" />清除對話
          </button>
        )}
      </header>

      <div className="flex-1 py-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-start">
            <p className="text-h3 text-ink">想知道什麼？</p>
            <p className="mt-1 text-caption text-muted">可以問你的課表、作業、考試、教室位置，或學校規定該看哪份文件。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-caption font-medium text-ink hover:border-primary/40">{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {messages.map((m, i) => <Message key={m.id} m={m} last={i === messages.length - 1} busy={busy} onRetry={retry} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-4 pb-3 pt-4 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-10 lg:px-10 lg:pb-6">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2 rounded-lg border border-line bg-surface p-2 shadow-lift focus-within:border-blue">
          <label htmlFor="chat-input" className="sr-only">輸入問題</label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="輸入問題，例如：這週有哪些考試？"
            enterKeyHint="send"
            className="max-h-36 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-body text-ink placeholder:text-muted focus:outline-none"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="停止回答" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ink text-canvas"><Square className="h-4 w-4" /></button>
          ) : (
            <button type="submit" aria-label="送出" disabled={!text.trim()} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-heritage text-white transition-opacity disabled:opacity-35')}>
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted">AI 可能出錯。涉及成績、學籍與規定的事項，請以學校公告為準。</p>
      </div>

      <ConfirmSheet open={confirmClear} onClose={() => setConfirmClear(false)} title="清除對話紀錄？" message="這個裝置上的對話紀錄會被刪除。" confirmLabel="清除" onConfirm={() => { clear(); setConfirmClear(false); }} />
    </div>
  );
}
