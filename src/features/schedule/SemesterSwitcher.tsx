import { useState } from 'react';
import { useSemester } from '@/app/SemesterProvider';
import { useUpsertSemester } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { semesterLabel } from '@/lib/data/semesters';
import { t } from '@/i18n/t';

export function SemesterSwitcher() {
  const { semester, semesters, setSemesterId } = useSemester();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertSemester();
  const toast = useToast();

  const submit = async () => {
    const m = code.trim().match(/^(\d{2,3})-([12])$/);
    if (!m) return setError(t('semester.codeFormat'));
    if (!start || !end || end <= start) return setError(t('semester.datesInvalid'));
    if (semesters.some((s) => s.code === code.trim())) return setError(t('semester.exists'));
    try {
      const s = await upsert.mutateAsync({ code: code.trim(), name: t('semester.name', { year: m[1], term: m[2] }), startDate: start, endDate: end });
      setSemesterId(s.id);
      setOpen(false);
      toast({ tone: 'success', message: t('semester.addedSwitched', { name: semesterLabel(s) }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('semester.addFailed'));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="semester" className="sr-only">{t('semester.label')}</label>
      <select
        id="semester"
        value={semester?.id ?? ''}
        onChange={(e) => (e.target.value === '__new' ? (setError(null), setOpen(true)) : setSemesterId(e.target.value))}
        className="h-9 rounded-sm border border-line bg-surface px-2.5 text-caption font-semibold text-ink"
      >
        {semesters.map((s) => <option key={s.id} value={s.id}>{semesterLabel(s)}</option>)}
        <option value="__new">{t('semester.addOption')}</option>
      </select>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('semester.add')}
        description={t('semester.addHint')}
        size="sm"
        footer={<><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button className="flex-1" onClick={submit} loading={upsert.isPending}>{t('semester.add')}</Button></>}
      >
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="sem-code">{t('semester.code')}</label>
            <input id="sem-code" className="field" placeholder="115-2" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="sem-start">{t('semester.start')}</label><input id="sem-start" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="label" htmlFor="sem-end">{t('semester.end')}</label><input id="sem-end" type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          {error && <p role="alert" className="text-caption text-danger">{error}</p>}
        </div>
      </Sheet>
    </div>
  );
}
