import { useState } from 'react';
import { useAuth } from '@/app/AuthProvider';
import { pushAvailable, removePushSubscription, savePushSubscription } from '@/services/pushSubscription';
import { BellRing } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { notificationSupport, readPrefs, showReminder, writePrefs, type ReminderPrefs } from '@/services/reminders';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

export function ReminderSettings() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<ReminderPrefs>(readPrefs);
  const [support, setSupport] = useState(notificationSupport);

  const { mode, session } = useAuth();
  const userId = mode === 'cloud' ? session?.user.id : undefined;
  const canPush = Boolean(userId) && pushAvailable();

  const update = (p: ReminderPrefs) => {
    setPrefs(p);
    writePrefs(p);
  };

  /** Keeps the server copy (push subscription + settings) in step; falls back to in-app reminders. */
  const sync = async (p: ReminderPrefs) => {
    if (!canPush || !userId) return update({ ...p, push: false });
    try {
      if (p.enabled) {
        await savePushSubscription(userId, p);
        update({ ...p, push: true });
      } else {
        await removePushSubscription();
        update({ ...p, push: false });
      }
    } catch {
      update({ ...p, push: false });
      if (p.enabled) toast({ tone: 'error', message: t('remind.pushFailed') });
    }
  };

  const toggle = async () => {
    if (prefs.enabled) return void sync({ ...prefs, enabled: false });
    if (support === 'unsupported') return;
    let perm = support;
    if (perm === 'default') {
      perm = (await Notification.requestPermission()) as typeof perm;
      setSupport(perm);
    }
    if (perm !== 'granted') {
      toast({ tone: 'error', message: t('remind.denied') });
      return;
    }
    const next = { ...prefs, enabled: true };
    update(next);
    toast({ tone: 'success', message: t('remind.enabled') });
    await sync(next);
  };

  const test = async () => {
    try {
      await showReminder({ id: `test-${Date.now()}`, at: Date.now(), title: t('remind.testTitle'), body: t('remind.testBody'), url: '/' });
    } catch {
      toast({ tone: 'error', message: t('remind.testFailed') });
    }
  };

  return (
    <section aria-labelledby="p-remind" className="mt-5 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="p-remind" className="text-h3 text-ink">{t('remind.title')}</h2>
          <p className="mt-0.5 text-caption text-muted">{t('remind.subtitle')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.enabled}
          aria-label={t('remind.toggle')}
          disabled={support === 'unsupported'}
          onClick={toggle}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40', prefs.enabled ? 'bg-primary' : 'bg-line')}
        >
          <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]', prefs.enabled ? 'left-[1.375rem]' : 'left-0.5')} />
        </button>
      </div>

      {support === 'unsupported' && <p className="mt-3 text-caption text-muted">{t('remind.unsupported')}</p>}
      {support === 'denied' && <p role="alert" className="mt-3 text-caption text-danger">{t('remind.blocked')}</p>}

      {prefs.enabled && (
        <div className="mt-4 grid gap-3">
          <div>
            <label htmlFor="r-class" className="label">{t('remind.classLabel')}</label>
            <select id="r-class" className="field" value={prefs.classMinutes} onChange={(e) => void sync({ ...prefs, classMinutes: Number(e.target.value) })}>
              <option value={0}>{t('remind.off')}</option>
              <option value={5}>{t('remind.before', { count: 5 })}</option>
              <option value={10}>{t('remind.before', { count: 10 })}</option>
              <option value={15}>{t('remind.before', { count: 15 })}</option>
              <option value={30}>{t('remind.before', { count: 30 })}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-body text-ink">
            <input type="checkbox" checked={prefs.tasks} onChange={(e) => void sync({ ...prefs, tasks: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
            {t('remind.tasks')}
          </label>
          <button type="button" onClick={test} className="inline-flex h-9 items-center gap-1.5 justify-self-start rounded-sm border border-line px-3 text-caption font-semibold text-ink hover:bg-sunken">
            <BellRing className="h-4 w-4" />{t('remind.test')}
          </button>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {prefs.enabled && prefs.push ? t('remind.notePush') : canPush ? t('remind.noteCanPush') : t('remind.note')}
      </p>
    </section>
  );
}
