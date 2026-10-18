import { useEffect, useState } from 'react';
import { Copy, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/app/AuthProvider';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n/t';
import { buildWidgetScript } from './widgetScript';

/** 32 random bytes, base64url. */
export function newWidgetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 我的 → 桌面小工具: create/revoke the personal widget token and copy the Scriptable script. */
export function WidgetSettings() {
  const { mode, session } = useAuth();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase || !userId) return;
    let alive = true;
    const client = supabase;
    (async () => {
      try {
        const { data } = await client.from('widget_tokens').select('user_id').eq('user_id', userId).maybeSingle();
        if (alive) setEnabled(Boolean(data));
      } catch {
        if (alive) setEnabled(false); // can't tell — offer to create one
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const create = async () => {
    if (!supabase || !userId) return;
    setBusy(true);
    try {
      const token = newWidgetToken();
      await supabase.from('widget_tokens').delete().eq('user_id', userId);
      const { error } = await supabase.from('widget_tokens').insert({ user_id: userId, token_hash: await sha256Hex(token) });
      if (error) throw new Error(error.message);
      setScript(buildWidgetScript(token, location.origin));
      setEnabled(true);
    } catch {
      toast({ tone: 'error', message: t('widget.failed') });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!supabase || !userId) return;
    setBusy(true);
    const { error } = await supabase.from('widget_tokens').delete().eq('user_id', userId);
    setBusy(false);
    if (error) return toast({ tone: 'error', message: t('widget.failed') });
    setScript('');
    setEnabled(false);
    toast({ tone: 'success', message: t('widget.revoked') });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      toast({ tone: 'success', message: t('widget.copied') });
    } catch {
      toast({ tone: 'error', message: t('widget.copyFailed') });
    }
  };

  return (
    <section aria-labelledby="p-widget" className="mt-5 rounded-lg border border-line bg-surface p-5">
      <h2 id="p-widget" className="flex items-center gap-2 text-h3 text-ink"><LayoutGrid className="h-5 w-5 text-heritage" aria-hidden />{t('widget.title')}</h2>
      <p className="mt-1 text-caption text-muted">{t('widget.intro')}</p>

      {mode !== 'cloud' ? (
        <p className="mt-3 rounded-sm bg-sunken px-3 py-3 text-caption text-muted">{t('widget.needsAccount')}</p>
      ) : (
        <>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-caption text-ink">
            <li>{t('widget.step1')}</li>
            <li>{t('widget.step2')}</li>
            <li>{t('widget.step3')}</li>
            <li>{t('widget.step4')}</li>
          </ol>

          {script ? (
            <div className="mt-4 grid gap-2">
              <Button onClick={copy}><Copy className="h-4 w-4" />{t('widget.copy')}</Button>
              <p className="text-[11px] text-muted">{t('widget.onceNote')}</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={create} disabled={busy || enabled === null}>{enabled ? t('widget.regenerate') : t('widget.create')}</Button>
            </div>
          )}

          {enabled && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">{t('widget.privacy')}</p>
              <button type="button" onClick={revoke} disabled={busy} className="shrink-0 text-caption font-semibold text-danger hover:underline">{t('widget.revoke')}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
