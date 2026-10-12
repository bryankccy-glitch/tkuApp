import { useState } from 'react';
import { useSemester } from '@/app/SemesterProvider';
import { useUpsertSemester } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

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
    if (!m) return setError('學期代碼格式為「學年-學期」，例如 115-2');
    if (!start || !end || end <= start) return setError('請填寫正確的起訖日期');
    if (semesters.some((s) => s.code === code.trim())) return setError('這個學期已經存在');
    try {
      const s = await upsert.mutateAsync({ code: code.trim(), name: `${m[1]} 學年度第 ${m[2]} 學期`, startDate: start, endDate: end });
      setSemesterId(s.id);
      setOpen(false);
      toast({ tone: 'success', message: `已新增並切換到 ${s.name}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="semester" className="sr-only">學期</label>
      <select
        id="semester"
        value={semester?.id ?? ''}
        onChange={(e) => (e.target.value === '__new' ? (setError(null), setOpen(true)) : setSemesterId(e.target.value))}
        className="h-9 rounded-sm border border-line bg-surface px-2.5 text-caption font-semibold text-ink"
      >
        {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="__new">＋ 新增學期…</option>
      </select>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="新增學期"
        description="起訖日期請以淡江大學行事曆為準。"
        size="sm"
        footer={<><Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>取消</Button><Button className="flex-1" onClick={submit} loading={upsert.isPending}>新增學期</Button></>}
      >
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="sem-code">學期代碼</label>
            <input id="sem-code" className="field" placeholder="115-2" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="sem-start">開始日期</label><input id="sem-start" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="label" htmlFor="sem-end">結束日期</label><input id="sem-end" type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          {error && <p role="alert" className="text-caption text-danger">{error}</p>}
        </div>
      </Sheet>
    </div>
  );
}
