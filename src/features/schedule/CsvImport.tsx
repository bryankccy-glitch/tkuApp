import { useState, type ChangeEvent } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { csvToCourses, CSV_HEADER, type ImportResult } from '@/lib/csv';
import { downloadText } from '@/lib/ics';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { t } from '@/i18n/t';

const SAMPLE = `${CSV_HEADER.join(',')}\r\n資料結構,,王老師,2,10:10,12:00,E304,blue,\r\n資料結構,,王老師,4,13:10,14:00,E304,blue,\r\n英文（一）,,,3,08:10,10:00,FL105,heritage,第 3 週小考`;

export function CsvImport({ open, onClose, onImport, importing }: { open: boolean; onClose: () => void; onImport: (r: ImportResult['courses']) => Promise<void>; importing: boolean }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 512 * 1024) {
      setResult({ courses: [], errors: [{ line: 0, message: t('csv.tooLarge') }] });
      return;
    }
    setFileName(f.name);
    setResult(csvToCourses(await f.text()));
  };

  const close = () => { setResult(null); setFileName(''); onClose(); };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('csv.title')}
      description={t('csv.description')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={close}>{t('common.cancel')}</Button>
          <Button className="flex-1" disabled={!result?.courses.length} loading={importing} onClick={async () => { await onImport(result!.courses); close(); }}>
            {result?.courses.length ? t('csv.importN', { count: result.courses.length }) : t('csv.import')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-sm bg-sunken p-3 text-caption text-muted">
          <p>{t('csv.help', { columns: CSV_HEADER.join('、') })}</p>
          <button type="button" className="mt-1 font-semibold text-link hover:underline" onClick={() => downloadText(t('csv.templateFile'), '\uFEFF' + SAMPLE, 'text/csv;charset=utf-8')}>
            {t('csv.template')}
          </button>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-line px-4 py-6 text-center hover:border-primary/40">
          <span className="text-body font-semibold text-ink">{fileName || t('csv.choose')}</span>
          <span className="text-caption text-muted">{t('csv.local')}</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
        </label>
        {result && (
          <div className="grid gap-2">
            {result.courses.length > 0 && (
              <div>
                <p className="text-label text-muted">{t('csv.willImport')}</p>
                <ul className="mt-1 divide-y divide-line rounded-sm border border-line">
                  {result.courses.map((c) => (
                    <li key={c.name} className="px-3 py-2 text-caption">
                      <span className="font-semibold text-ink">{c.name}</span>
                      <span className="ml-2 text-muted">{c.slots.map((s) => `${WEEKDAY_LABELS[s.weekday]} ${s.startTime}–${s.endTime} ${s.room}`).join('；')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.errors.length > 0 && (
              <div role="alert" className="rounded-sm border border-danger/30 bg-danger/5 p-3 text-caption">
                <p className="font-semibold text-danger">{t('csv.failedRows', { count: result.errors.length })}</p>
                <ul className="mt-1 text-muted">
                  {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e.line ? t('csv.rowPrefix', { line: e.line }) : ''}{e.message}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
