import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Wordmark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/AuthProvider';
import { supabase } from '@/lib/supabase';

const schema = z
  .object({ password: z.string().min(8, '密碼至少 8 個字元').max(72, '密碼最多 72 個字元'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: '兩次輸入的密碼不一致', path: ['confirm'] });

/**
 * Landing page for the Supabase recovery email link.
 * The client exchanges the link's code for a session automatically; we then let the user set a new password.
 */
export default function ResetPasswordPage() {
  const { mode, session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (mode === 'local') return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setSaving(true);
    const { error: err } = await supabase!.auth.updateUser({ password: parsed.data.password });
    setSaving(false);
    if (err) return setError(err.message);
    navigate('/', { replace: true });
  };

  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-app items-start justify-center bg-canvas px-4 pt-16">
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lift">
        <Wordmark />
        <h1 className="mt-6 text-h2 text-ink">設定新密碼</h1>
        {!session ? (
          loading || !waited ? (
            <p role="status" className="mt-3 text-body text-muted">正在驗證重設連結…</p>
          ) : (
            <div className="mt-3">
              <p role="alert" className="text-body text-ink">這個重設連結無效或已過期。</p>
              <Link to="/login" className="mt-3 inline-block font-semibold text-link hover:underline">回到登入頁重新申請</Link>
            </div>
          )
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
            <div><label className="label" htmlFor="np">新密碼</label><input id="np" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><label className="label" htmlFor="np2">再輸入一次</label><input id="np2" type="password" autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            {error && <p role="alert" className="text-caption text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={saving}>更新密碼</Button>
          </form>
        )}
      </div>
    </div>
  );
}
