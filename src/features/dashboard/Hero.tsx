import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { Colonnade } from '@/components/brand/Colonnade';
import { dayPhase, formatDateLong, greeting, type DayPhase } from '@/lib/time';
import { cn } from '@/lib/cn';

const SKIES: Record<DayPhase, string> = {
  dawn: 'from-[#7A2B29] via-[#A24A43] to-[#E3A77F]',
  day: 'from-[#8C3431] via-[#A84643] to-[#C9675B]',
  dusk: 'from-[#5A2230] via-[#91404A] to-[#E0875F]',
  night: 'from-[#22111A] via-[#40192A] to-[#5E2530]',
};

const SUGGESTIONS = ['明天第一堂課在哪裡？', '這週有哪些作業？', '淡江病假怎麼請？'];

export function Hero({ name, now, summary }: { name: string; now: Date; summary: string }) {
  const phase = dayPhase(now);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ask = (text: string) => {
    const t = text.trim();
    if (t) navigate(`/assistant?q=${encodeURIComponent(t)}`);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };

  return (
    <section aria-labelledby="hero-greeting" className={cn('relative overflow-hidden rounded-lg bg-gradient-to-br text-white', SKIES[phase])}>
      <div className="relative z-10 px-5 pb-24 pt-6">
        <p className="text-caption text-white/75">{formatDateLong(now)}</p>
        <h1 id="hero-greeting" className="mt-1 text-[1.75rem] font-bold leading-tight tracking-tight">
          {greeting(now)}，{name}
        </h1>
        <p className="mt-2 max-w-md text-body-lg text-white/85">{summary}</p>

        <form onSubmit={onSubmit} className="mt-5 max-w-lg">
          <label htmlFor="hero-ask" className="sr-only">問 AI 校園助理</label>
          <div className="flex items-center rounded-sm bg-white/95 p-1 pl-4 shadow-lift dark:bg-[#0E1B2C]/90">
            <input
              id="hero-ask"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="問問校園助理，例如：明天第一堂在哪？"
              className="h-10 min-w-0 flex-1 bg-transparent text-body text-[#253244] placeholder:text-[#5C697C] focus:outline-none dark:text-white dark:placeholder:text-white/60"
              maxLength={300}
            />
            <button type="submit" aria-label="送出問題" disabled={!q.trim()} className="flex h-10 w-10 items-center justify-center rounded-xs bg-primary text-white disabled:opacity-40">
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-white/30 px-3 py-1 text-caption text-white/90 hover:bg-white/10">
                {s}
              </button>
            ))}
          </div>
        </form>
      </div>
      <Colonnade className="absolute inset-x-0 bottom-0 h-16 text-[#2A0E10]/75" arches={18} />
    </section>
  );
}
