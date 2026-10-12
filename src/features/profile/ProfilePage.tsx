import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useAuth, useRepo } from '@/app/AuthProvider';
import { useTheme, type ThemePref } from '@/app/ThemeProvider';
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
    if (!n || n.length > 40) return toast({ tone: 'error', message: '暱稱需為 1–40 字' });
    try {
      await update.mutateAsync({ displayName: n, department: dept.trim().slice(0, 60) || undefined, grade: grade.trim().slice(0, 20) || undefined });
      toast({ tone: 'success', message: '已儲存個人資料' });
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : '儲存失敗' });
    }
  };

  const exportData = async () => {
    const bundle = await repo.exportAll();
    downloadText(`tku-campus-os-資料匯出-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2), 'application/json');
    toast({ tone: 'success', message: '已匯出你的資料' });
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      await repo.deleteAllData();
      try { localStorage.removeItem('tku.chat.v1'); localStorage.removeItem('tku.bookmarks'); localStorage.removeItem('tku.semester'); } catch { /* ignore */ }
      qc.clear();
      toast({ tone: 'success', message: mode === 'cloud' ? '帳號與所有資料已刪除' : '此裝置上的資料已全部刪除' });
      setConfirmDelete(false);
      if (mode === 'local') location.assign('/');
    } catch (e) {
      toast({ tone: 'error', message: e instanceof Error ? e.message : '刪除失敗' });
    } finally {
      setDeleting(false);
    }
  };

  const sendFeedback = async () => {
    if (!supabase || !feedback.trim()) return;
    const { error } = await supabase.from('feedback').insert({ message: feedback.trim().slice(0, 2000), page: '/me' });
    if (error) return toast({ tone: 'error', message: '送出失敗，請稍後再試' });
    setFeedback('');
    toast({ tone: 'success', message: '謝謝你的回饋！' });
  };

  const themes: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: 'light', label: '淺色', icon: Sun },
    { v: 'dark', label: '深色', icon: Moon },
    { v: 'system', label: '跟隨系統', icon: Monitor },
  ];

  return (
    <Page>
      <PageHeader title="我的" subtitle={mode === 'cloud' ? session?.user.email : '本機模式：資料只存在這個瀏覽器，不會上傳。'} />

      <section aria-labelledby="p-info" className="rounded-lg border border-line bg-surface p-5">
        <h2 id="p-info" className="text-h3 text-ink">個人資料</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3"><label className="label" htmlFor="p-name">暱稱</label><input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="p-dept">系所</label><input id="p-dept" className="field" placeholder="選填，例如：資訊工程學系" value={dept} onChange={(e) => setDept(e.target.value)} maxLength={60} /></div>
          <div><label className="label" htmlFor="p-grade">年級</label><input id="p-grade" className="field" placeholder="選填" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} /></div>
        </div>
        <Button className="mt-4" onClick={save} loading={update.isPending}>儲存</Button>
        <p className="mt-2 text-[11px] text-muted">只收集顯示所需的最少資料。我們不會要求學號或校務系統密碼。</p>
      </section>

      <section aria-labelledby="p-theme" className="mt-5 rounded-lg border border-line bg-surface p-5">
        <h2 id="p-theme" className="text-h3 text-ink">外觀</h2>
        <div role="radiogroup" aria-label="主題" className="mt-3 grid grid-cols-3 gap-2">
          {themes.map(({ v, label, icon: Icon }) => (
            <button key={v} type="button" role="radio" aria-checked={pref === v} onClick={() => setPref(v)}
              className={cn('flex flex-col items-center gap-1.5 rounded-sm border py-3 text-caption font-semibold', pref === v ? 'border-navy bg-navy/[0.06] text-navy' : 'border-line text-muted hover:text-ink')}>
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="p-data" className="mt-5 rounded-lg border border-line bg-surface">
        <h2 id="p-data" className="px-5 pt-5 text-h3 text-ink">資料與隱私</h2>
        <ul className="mt-2 divide-y divide-line">
          <li>
            <button type="button" onClick={exportData} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken">
              <Download className="h-5 w-5 text-muted" /><span className="flex-1"><span className="block text-body font-semibold text-ink">匯出我的資料</span><span className="text-caption text-muted">課表、待辦與個人資料（JSON）</span></span>
            </button>
          </li>
          <li>
            <Link to="/about" className="flex items-center gap-3 px-5 py-3.5 hover:bg-sunken">
              <span className="flex-1"><span className="block text-body font-semibold text-ink">關於與隱私說明</span><span className="text-caption text-muted">資料來源、查核狀態與使用條款</span></span><ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </li>
          {mode === 'cloud' && (
            <li>
              <button type="button" onClick={signOut} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken">
                <LogOut className="h-5 w-5 text-muted" /><span className="text-body font-semibold text-ink">登出</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-danger/5">
              <Trash2 className="h-5 w-5 text-danger" /><span className="text-body font-semibold text-danger">{mode === 'cloud' ? '刪除帳號' : '刪除此裝置上的所有資料'}</span>
            </button>
          </li>
        </ul>
      </section>

      {mode === 'cloud' && (
        <section aria-labelledby="p-fb" className="mt-5 rounded-lg border border-line bg-surface p-5">
          <h2 id="p-fb" className="text-h3 text-ink">意見回饋</h2>
          <label htmlFor="fb" className="sr-only">回饋內容</label>
          <textarea id="fb" rows={3} className="field mt-3" maxLength={2000} placeholder="發現錯誤或資料過時？告訴我們。" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <Button className="mt-3" variant="secondary" onClick={sendFeedback} disabled={!feedback.trim()}>送出回饋</Button>
        </section>
      )}

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={mode === 'cloud' ? '刪除帳號？' : '刪除所有資料？'}
        message={mode === 'cloud' ? '帳號、課表、待辦、收藏與 AI 對話紀錄會永久刪除，無法復原。建議先匯出資料。' : '這個瀏覽器中的課表、待辦、收藏與對話紀錄會永久刪除，無法復原。'}
        confirmLabel="永久刪除"
        loading={deleting}
        onConfirm={deleteAll}
      />
    </Page>
  );
}
