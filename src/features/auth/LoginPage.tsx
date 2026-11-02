import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from '@/lib/zod';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { Eye, EyeOff } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { PixelCampusScene } from '@/components/campus-scene/PixelCampusScene';
import { buildScene } from '@/components/campus-scene/SceneController';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/AuthProvider';
import { useCampusWeather } from '@/hooks/useCampusWeather';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/cn';

type Tab = 'in' | 'up' | 'forgot';

/** Live Danjiang Bridge scene behind the sign-in header (same weather + sun data as Home). */
function LoginScene() {
  const { t } = useTranslation();
  const { weather } = useCampusWeather();
  const tod = useTimeOfDay(weather);
  const scene = useMemo(() => buildScene(tod.now, tod.sunrise, tod.sunset, weather), [tod, weather]);
  return <PixelCampusScene scene={scene} label={t('hero.sceneLabel', { scene: t(`weather.scene.${scene.kind}`) })} />;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, cloudAvailable, isGuest, continueAsGuest } = useAuth();
  const [tab, setTab] = useState<Tab>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!cloudAvailable || session) return <Navigate to="/" replace />;

  const emailSchema = z.string().trim().email(t('auth.emailInvalid'));
  const pwSchema = z.string().min(8, t('auth.passwordMin')).max(72, t('auth.passwordMax'));

  const switchTab = (next: Tab) => { setTab(next); setError(null); setInfo(null); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return setError(em.error.issues[0]!.message);

    if (tab === 'forgot') {
      setLoading(true);
      const { error: err } = await supabase!.auth.resetPasswordForEmail(em.data, { redirectTo: `${location.origin}/reset-password` });
      setLoading(false);
      // Same message whether or not the account exists, so the form can't be used to probe emails.
      if (err) return setError(/rate/i.test(err.message) ? t('auth.rateLimited') : t('auth.sendFailed'));
      return setInfo(t('auth.resetSent'));
    }

    const pw = pwSchema.safeParse(password);
    if (!pw.success) return setError(pw.error.issues[0]!.message);
    const name = nickname.trim().slice(0, 40);

    setLoading(true);
    const res = tab === 'in'
      ? await supabase!.auth.signInWithPassword({ email: em.data, password: pw.data })
      : await supabase!.auth.signUp({
          email: em.data,
          password: pw.data,
          options: { emailRedirectTo: location.origin, data: name ? { display_name: name } : undefined },
        });
    setLoading(false);
    if (res.error) {
      const msg = res.error.message;
      if (msg === 'Invalid login credentials') return setError(t('auth.badCredentials'));
      if (/email not confirmed/i.test(msg)) return setError(t('auth.notConfirmed'));
      if (/already registered/i.test(msg)) return setError(t('auth.alreadyRegistered'));
      if (/rate/i.test(msg)) return setError(t('auth.rateLimited'));
      if (/failed to fetch|network|load failed/i.test(msg)) return setError(t('auth.network'));
      return setError(msg);
    }
    if (tab === 'up' && !res.data.session) setInfo(t('auth.verifySent'));
  };

  const guest = () => { continueAsGuest(); navigate('/', { replace: true }); };

  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-app flex-col bg-canvas">
      <header className="relative h-[300px] shrink-0 overflow-hidden bg-[#171717] text-white">
        <LoginScene />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[linear-gradient(180deg,rgb(10_10_14/0.6)_0%,rgb(10_10_14/0.3)_60%,rgb(10_10_14/0)_100%)]" />
        <div className="relative z-10 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] [text-shadow:0_1px_2px_rgb(0_0_0/0.55)]">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 rounded-[10px]" />
            <span className="text-body font-bold tracking-tight">TKU Campus OS</span>
          </div>
          <h1 className="mt-6 text-[1.75rem] font-bold leading-tight tracking-tight">{t('auth.welcome')}</h1>
          <p className="mt-1.5 max-w-[18rem] text-body text-white/90">{t('auth.tagline')}</p>
        </div>
      </header>

      <main className="relative z-10 -mt-7 flex-1 rounded-t-[28px] bg-canvas px-5 pb-[calc(1.5rem+var(--safe-bottom))] pt-6">
        {tab === 'forgot' ? (
          <div className="mb-5">
            <h2 className="text-h3 text-ink">{t('auth.resetTitle')}</h2>
            <p className="mt-1 text-caption text-muted">{t('auth.resetHint')}</p>
          </div>
        ) : (
          <div role="tablist" aria-label={t('auth.signIn')} className="mb-5 grid grid-cols-2 rounded-sm bg-sunken p-1">
            {(['in', 'up'] as const).map((k) => (
              <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls="auth-form" onClick={() => switchTab(k)}
                className={cn('h-10 rounded-xs text-body font-semibold transition-colors', tab === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                {k === 'in' ? t('auth.signIn') : t('auth.signUp')}
              </button>
            ))}
          </div>
        )}

        <form id="auth-form" role={tab === 'forgot' ? undefined : 'tabpanel'} aria-labelledby={tab === 'forgot' ? undefined : `tab-${tab}`} onSubmit={submit} noValidate className="grid gap-3.5">
          {tab === 'up' && (
            <div>
              <label className="label" htmlFor="nickname">{t('auth.nickname')} <span className="font-normal text-muted">· {t('common.optional')}</span></label>
              <input id="nickname" autoComplete="nickname" className="field" maxLength={40} placeholder={t('defaults.studentName')} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {tab !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="pw">{t('auth.password')}</label>
                {tab === 'in' && <button type="button" onClick={() => switchTab('forgot')} className="mb-1.5 text-label font-semibold text-link hover:underline">{t('auth.forgot')}</button>}
              </div>
              <div className="relative">
                <input id="pw" type={showPw ? 'text' : 'password'} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} className="field pr-11" value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={tab === 'up' ? 'pw-hint' : undefined} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={showPw}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink">
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {tab === 'up' && <p id="pw-hint" className="mt-1.5 text-label text-muted">{t('auth.passwordHint')}</p>}
            </div>
          )}

          {error && <p role="alert" className="text-caption text-danger">{error}</p>}
          {info && <p role="status" className="rounded-sm bg-success/10 px-3 py-2.5 text-caption text-success">{info}</p>}

          <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
            {tab === 'in' ? t('auth.signIn') : tab === 'up' ? t('auth.createAccount') : t('auth.sendReset')}
          </Button>
          {tab === 'forgot' && (
            <button type="button" onClick={() => switchTab('in')} className="h-10 text-caption font-semibold text-link hover:underline">{t('auth.backToSignIn')}</button>
          )}
        </form>

        {tab !== 'forgot' && (
          <>
            <div className="my-5 flex items-center gap-3 text-label text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" />{t('auth.or')}<span className="h-px flex-1 bg-line" />
            </div>
            <Button variant="secondary" size="lg" className="w-full" onClick={guest}>
              {isGuest ? t('auth.backAsGuest') : t('auth.guest')}
            </Button>
            <p className="mt-2 text-center text-label text-muted">{t('auth.guestHint')}</p>
          </>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-muted">{t('auth.notice')}</p>
        <LegalLinks className="mt-3" />
      </main>
    </div>
  );
}
