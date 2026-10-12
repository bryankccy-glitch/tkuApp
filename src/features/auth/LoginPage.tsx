import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Wordmark } from '@/components/brand/Logo';
import { Colonnade } from '@/components/brand/Colonnade';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/AuthProvider';
import { supabase } from '@/lib/supabase';
import { t as tx } from '@/i18n/t';

const schema = z.object({ email: z.string().trim().email(tx('auth.emailInvalid')), password: z.string().min(8, tx('auth.passwordMin')) });

export default function LoginPage() {
  const { session, mode } = useAuth();
  const [tab, setTab] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (mode === 'local' || session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (tab === 'forgot') {
      const em = z.string().trim().email(tx('auth.emailInvalid')).safeParse(email);
      if (!em.success) return setError(em.error.issues[0]!.message);
      setLoading(true);
      const { error: err } = await supabase!.auth.resetPasswordForEmail(em.data, { redirectTo: `${location.origin}/reset-password` });
      setLoading(false);
      // Same message whether or not the account exists, so the form can't be used to probe emails.
      if (err && !/rate/i.test(err.message)) return setError(tx('auth.sendFailed'));
      if (err) return setError(tx('auth.rateLimited'));
      return setInfo(tx('auth.resetSent'));
    }
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setLoading(true);
    const res = tab === 'in'
      ? await supabase!.auth.signInWithPassword(parsed.data)
      : await supabase!.auth.signUp({ ...parsed.data, options: { emailRedirectTo: location.origin } });
    setLoading(false);
    if (res.error) return setError(res.error.message === 'Invalid login credentials' ? tx('auth.badCredentials') : res.error.message);
    if (tab === 'up' && !res.data.session) setInfo(tx('auth.verifySent'));
  };

  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-app flex-col bg-canvas">
      <div className="relative overflow-hidden bg-primary text-white dark:bg-[#132A47]">
        <div className="mx-auto max-w-md px-6 pb-24 pt-10">
          <div className="[&_*]:!text-white"><Wordmark /></div>
          <h1 className="mt-8 text-h1">One Campus. One OS.</h1>
          <p className="mt-2 text-body text-white/80">{tx('auth.tagline')}</p>
        </div>
        <Colonnade className="absolute inset-x-0 bottom-0 h-16 text-[#0B1A2E]/50" arches={16} />
      </div>
      <main className="mx-auto -mt-8 w-full max-w-md flex-1 px-4 pb-10">
        <div className="rounded-lg bg-surface p-6 shadow-lift">
          {tab === 'forgot' ? (
            <div className="mb-5">
              <h2 className="text-h3 text-ink">{tx('auth.resetTitle')}</h2>
              <p className="mt-1 text-caption text-muted">{tx('auth.resetHint')}</p>
            </div>
          ) : (
          <div role="tablist" className="mb-5 grid grid-cols-2 rounded-sm bg-sunken p-1">
            {(['in', 'up'] as const).map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 rounded-xs text-caption font-semibold ${tab === t ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
                {t === 'in' ? tx('auth.signIn') : tx('auth.signUp')}
              </button>
            ))}
          </div>
          )}
          <form onSubmit={submit} noValidate className="grid gap-3">
            <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {tab !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="pw">{tx('auth.password')}</label>
                  {tab === 'in' && <button type="button" onClick={() => { setTab('forgot'); setError(null); setInfo(null); }} className="mb-1.5 text-label text-link hover:underline">{tx('auth.forgot')}</button>}
                </div>
                <input id="pw" type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {error && <p role="alert" className="text-caption text-danger">{error}</p>}
            {info && <p role="status" className="text-caption text-success">{info}</p>}
            <Button type="submit" size="lg" loading={loading} className="mt-1">{tab === 'in' ? tx('auth.signIn') : tab === 'up' ? tx('auth.createAccount') : tx('auth.sendReset')}</Button>
            {tab === 'forgot' && <button type="button" onClick={() => { setTab('in'); setError(null); setInfo(null); }} className="text-caption font-semibold text-link hover:underline">{tx('auth.backToSignIn')}</button>}
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            {tx('auth.notice')}
          </p>
        </div>
      </main>
    </div>
  );
}
