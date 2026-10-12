import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { notificationSupport, readPrefs, showReminder, writePrefs, type ReminderPrefs } from '@/services/reminders';
import { cn } from '@/lib/cn';

export function ReminderSettings() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<ReminderPrefs>(readPrefs);
  const [support, setSupport] = useState(notificationSupport);

  const update = (p: ReminderPrefs) => {
    setPrefs(p);
    writePrefs(p);
  };

  const toggle = async () => {
    if (prefs.enabled) return update({ ...prefs, enabled: false });
    if (support === 'unsupported') return;
    let perm = support;
    if (perm === 'default') {
      perm = (await Notification.requestPermission()) as typeof perm;
      setSupport(perm);
    }
    if (perm !== 'granted') {
      toast({ tone: 'error', message: '通知權限未開啟，請到瀏覽器或手機設定允許通知' });
      return;
    }
    update({ ...prefs, enabled: true });
    toast({ tone: 'success', message: '已開啟上課與截止提醒' });
  };

  const test = async () => {
    try {
      await showReminder({ id: `test-${Date.now()}`, at: Date.now(), title: 'TKU Campus OS 提醒測試', body: '收到這則通知，表示提醒已設定完成。', url: '/' });
    } catch {
      toast({ tone: 'error', message: '無法顯示通知，請檢查通知權限' });
    }
  };

  return (
    <section aria-labelledby="p-remind" className="mt-5 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="p-remind" className="text-h3 text-ink">上課與截止提醒</h2>
          <p className="mt-0.5 text-caption text-muted">在這台裝置上用系統通知提醒你。</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.enabled}
          aria-label="開啟提醒"
          disabled={support === 'unsupported'}
          onClick={toggle}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40', prefs.enabled ? 'bg-primary' : 'bg-line')}
        >
          <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]', prefs.enabled ? 'left-[1.375rem]' : 'left-0.5')} />
        </button>
      </div>

      {support === 'unsupported' && <p className="mt-3 text-caption text-muted">這個瀏覽器不支援通知。iPhone 請先用 Safari「加入主畫面」安裝 App 後再開啟。</p>}
      {support === 'denied' && <p role="alert" className="mt-3 text-caption text-danger">通知權限已被拒絕，請到瀏覽器或手機設定中允許 TKU Campus OS 傳送通知。</p>}

      {prefs.enabled && (
        <div className="mt-4 grid gap-3">
          <div>
            <label htmlFor="r-class" className="label">上課提醒</label>
            <select id="r-class" className="field" value={prefs.classMinutes} onChange={(e) => update({ ...prefs, classMinutes: Number(e.target.value) })}>
              <option value={0}>不提醒</option>
              <option value={5}>上課前 5 分鐘</option>
              <option value={10}>上課前 10 分鐘</option>
              <option value={15}>上課前 15 分鐘</option>
              <option value={30}>上課前 30 分鐘</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-body text-ink">
            <input type="checkbox" checked={prefs.tasks} onChange={(e) => update({ ...prefs, tasks: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
            作業與考試依各自設定的時間提醒
          </label>
          <button type="button" onClick={test} className="inline-flex h-9 items-center gap-1.5 justify-self-start rounded-sm border border-line px-3 text-caption font-semibold text-ink hover:bg-sunken">
            <BellRing className="h-4 w-4" />傳送測試通知
          </button>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        App 開著或在背景執行時會準時提醒；完全關閉 App 後的推播需要伺服器支援，正在規劃中。也可以在課程或待辦上用「加入提醒」存進手機行事曆。
      </p>
    </section>
  );
}
