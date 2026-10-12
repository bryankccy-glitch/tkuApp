import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, ListChecks, LogOut, Megaphone, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth, useRepo } from '@/app/AuthProvider';
import { useTheme, type ThemePref } from '@/app/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { ReminderSettings } from './ReminderSettings';
import { useProfile, useUpdateProfile } from '@/lib/hooks';
import { downloadText } from '@/lib/ics';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/cn';

export default function ProfilePage() {
  const { mode, session, signOut } = useAuth();
  const repo = useRepo();
  const qc = useQueryClient();
  const toast = useToast();
  const { pref, setPref } = useTheme();
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [grade, setGrade] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setName(profile?.displayName ?? '');
    setDept(profile?.department ?? '');
    setGrade(profile?.grade ?? '');
  }, [profile]);

  const save = async () => {
    const n = name.trim();
    if (!n || n.length > 40) return toast({ tone: 'error', message: t('me.nameInvalid') });
    try {
      await update.mutateAsync({ displayName: n, department: dept.trim().slice(0, 60) || undefined, grade: grade.trim().slice(0, 20) || undefined });
      toast({ tone: 'success', message: t('me.profileSaved') });
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : t('common.saveFailed') });
    }
  };

  const exportData = async () => {
    const bundle = await repo.exportAll();
    downloadText(t('me.exportFile', { date: new Date().toISOString().slice(0, 10) }), JSON.stringify(bundle, null, 2), 'application/json');
    toast({ tone: 'success', message: t('me.exported') });
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await repo.deleteAllData();
      try { ['tku.chat.v1', 'tku.bookmarks', 'tku.semester', 'tku.reminders.v1', 'tku.reminders.fired.v1', 'tku.weather.v1'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      qc.clear();
      toast({ tone: 'success', message: mode === 'cloud' ? t('me.deletedCloud') : t('me.deletedLocal') });
      setConfirmDelete(false);
      if (mode === 'local') location.assign('/');
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : t('me.deleteFailed') });
    } finally {
      setDeleting(false);
    }
  };

  const sendFeedback = async () => {
    if (!supabase || !feedback.trim()) return;
    const { error } = await supabase.from('feedback').insert({ message: feedback.trim().slice(0, 2000), page: '/me' });
    if (error) return toast({ tone: 'error', message: t('me.feedbackFailed') });
    setFeedback('');
    toast({ tone: 'success', message: t('me.feedbackThanks') });
  };

  const themes: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: 'light', label: t('me.themeLight'), icon: Sun },
    { v: 'dark', label: t('me.themeDark'), icon: Moon },
    { v: 'system', label: t('me.themeSystem'), icon: Monitor },
  ];

  return (
    <Page>
      <PageHeader title={t('me.title')} subtitle={mode === 'cloud' ? session?.user.email : t('me.localSubtitle')} />

      <nav aria-label={t('me.shortcuts')} className="mb-5 grid grid-cols-2 gap-2">
        <Link to="/tasks" className="flex items-center gap-2.5 rounded-sm border border-line bg-surface px-3 py-3 text-body font-semibold text-ink hover:bg-sunken">
          <ListChecks className="h-5 w-5 text-primary" />{t('tasks.title')}
        </Link>
        <Link to="/events" className="flex items-center gap-2.5 rounded-sm border border-line bg-surface px-3 py-3 text-body font-semibold text-ink hover:bg-sunken">
          <Megaphone className="h-5 w-5 text-primary" />{t('events.title')}
        </Link>
      </nav>

      <section aria-labelledby="p-info" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="p-info" className="text-h3 text-ink">{t('me.profile')}</h2>
        <div className="mt-4 grid gap-3 grid-cols-3">
          <div className="col-span-3"><label className="label" htmlFor="p-name">{t('me.nickname')}</label><input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
          <div className="col-span-2"><label className="label" htmlFor="p-dept">{t('me.department')}</label><input id="p-dept" className="field" placeholder={t('me.departmentPlaceholder')} value={dept} onChange={(e) => setDept(e.target.value)} maxLength={60} /></div>
          <div><label className="label" htmlFor="p-grade">{t('me.grade')}</label><input id="p-grade" className="field" placeholder={t('common.optional')} value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} /></div>
        </div>
        <Button className="mt-4" onClick={save} loading={update.isPending}>{t('me.save')}</Button>
        <p className="mt-2 text-[11px] text-muted">{t('me.minimalData')}</p>
      </section>

      <section aria-labelledby="p-theme" className="mt-5 rounded-lg border border-line bg-surface p-5">
        <h2 id="p-theme" className="text-h3 text-ink">{t('me.appearance')}</h2>
        <div role="radiogroup" aria-label={t('me.theme')} className="mt-3 grid grid-cols-3 gap-2">
          {themes.map(({ v, label, icon: Icon }) => (
            <button key={v} type="button" role="radio" aria-checked={pref === v} onClick={() => setPref(v)}
              className={cn('flex flex-col items-center gap-1.5 rounded-sm border py-3 text-caption font-semibold', pref === v ? 'border-primary bg-primary/[0.06] text-primary' : 'border-line text-muted hover:text-ink')}>
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
        </div>
        <h3 id="p-lang" className="mt-5 text-body font-semibold text-ink">{t('settings.language')}</h3>
        <div role="radiogroup" aria-labelledby="p-lang" className="mt-2 grid grid-cols-2 gap-2">
          {(['zh-TW', 'en'] as const).map((lng) => (
            <button key={lng} type="button" role="radio" aria-checked={i18n.language === lng} onClick={() => void i18n.changeLanguage(lng)}
              className={cn('h-11 rounded-sm border text-caption font-semibold', i18n.language === lng ? 'border-primary bg-primary/[0.06] text-primary' : 'border-line text-muted hover:text-ink')}>
              {t(lng === 'en' ? 'settings.en' : 'settings.zh')}
            </button>
          ))}
        </div>
      </section>

      <ReminderSettings />

      <section aria-labelledby="p-data" className="mt-5 rounded-lg border border-line bg-surface">
        <h2 id="p-data" className="px-5 pt-5 text-h3 text-ink">{t('me.dataPrivacy')}</h2>
        <ul className="mt-2 divide-y divide-line">
          <li>
            <button type="button" onClick={exportData} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken">
              <Download className="h-5 w-5 text-muted" /><span className="flex-1"><span className="block text-body font-semibold text-ink">{t('me.export')}</span><span className="text-caption text-muted">{t('me.exportHint')}</span></span>
            </button>
          </li>
          <li>
            <Link to="/about" className="flex items-center gap-3 px-5 py-3.5 hover:bg-sunken">
              <span className="flex-1"><span className="block text-body font-semibold text-ink">{t('me.about')}</span><span className="text-caption text-muted">{t('me.aboutHint')}</span></span><ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </li>
          {mode === 'cloud' && (
            <li>
              <button type="button" onClick={signOut} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken">
                <LogOut className="h-5 w-5 text-muted" /><span className="text-body font-semibold text-ink">{t('me.signOut')}</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-danger/5">
              <Trash2 className="h-5 w-5 text-danger" /><span className="text-body font-semibold text-danger">{mode === 'cloud' ? t('me.deleteAccount') : t('me.deleteLocal')}</span>
            </button>
          </li>
        </ul>
      </section>

      {mode === 'cloud' && (
        <section aria-labelledby="p-fb" className="mt-5 rounded-lg border border-line bg-surface p-5">
          <h2 id="p-fb" className="text-h3 text-ink">{t('me.feedback')}</h2>
          <label htmlFor="fb" className="sr-only">{t('me.feedbackLabel')}</label>
          <textarea id="fb" rows={3} className="field mt-3" maxLength={2000} placeholder={t('me.feedbackPlaceholder')} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <Button className="mt-3" variant="secondary" onClick={sendFeedback} disabled={!feedback.trim()}>{t('me.sendFeedback')}</Button>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] text-muted">{t('me.unofficial')}</p>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={mode === 'cloud' ? t('me.deleteAccountTitle') : t('me.deleteAllTitle')}
        message={mode === 'cloud' ? t('me.deleteAccountBody') : t('me.deleteLocalBody')}
        confirmLabel={t('me.deleteForever')}
        loading={deleting}
        onConfirm={deleteAll}
      />
    </Page>
  );
}
