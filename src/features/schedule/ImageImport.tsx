import { useMemo, useState, type ChangeEvent } from 'react';
import type { ReadProgress } from '@/lib/ocr/readTimetable';
import { AlertTriangle, ImagePlus, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { LoadingMark } from '@/components/brand/Logo';
import { cellsToCourses, colorFor, type DraftCourse, type ImportCell } from '@/lib/timetableImport';
import { conflictsFor } from '@/lib/schedule';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { formatPeriods } from '@/lib/periods';
import { roomWithBuilding } from '@/data/places';
import type { CourseInput } from '@/lib/data/repository';
import type { Course } from '@/lib/types';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

export type RecognizeError = 'engine' | 'not_timetable' | 'too_large' | 'failed';
export class TimetableImportError extends Error {
  constructor(public kind: RecognizeError) { super(kind); }
}

/** Reads the screenshot on the device (no upload, no API key). */
export async function recognizeOnDevice(file: File, onProgress?: (p: ReadProgress) => void): Promise<ImportCell[]> {
  let mod: typeof import('@/lib/ocr/readTimetable');
  try {
    mod = await import('@/lib/ocr/readTimetable');
  } catch {
    throw new TimetableImportError('engine');
  }
  try {
    return await mod.readTimetableImage(file, onProgress);
  } catch (e) {
    if (e instanceof mod.NotATimetableError) throw new TimetableImportError('not_timetable');
    // Engine download / WASM start-up failures (offline on first use, old browser).
    if (e instanceof Error && /fetch|network|wasm|worker|load/i.test(e.message)) throw new TimetableImportError('engine');
    throw new TimetableImportError('failed');
  }
}

type Step = 'pick' | 'reading' | 'review';
interface Row extends DraftCourse { include: boolean; duplicate: boolean }

const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function ImageImport({ open, onClose, existing, onImport, importing, onUseCsv, recognize = recognizeOnDevice }: {
  open: boolean;
  onClose: () => void;
  existing: Course[];
  onImport: (list: Omit<CourseInput, 'semesterId'>[]) => Promise<void>;
  importing: boolean;
  onUseCsv: () => void;
  /** Injected in tests. */
  recognize?: (file: File, onProgress?: (p: ReadProgress) => void) => Promise<ImportCell[]>;
}) {
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<RecognizeError | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const existingNames = useMemo(() => new Set(existing.map((c) => norm(c.name))), [existing]);

  const reset = () => { setStep('pick'); setError(null); setRows([]); setSkipped(0); setProgress(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) return setError('failed');
    if (file.size > 25 * 1024 * 1024) return setError('too_large');
    setStep('reading');
    try {
      setProgress(null);
      const cells = await recognize(file, setProgress);
      const result = cellsToCourses(cells);
      if (result.courses.length === 0) throw new TimetableImportError('not_timetable');
      setRows(result.courses.map((c) => {
        const duplicate = existingNames.has(norm(c.name));
        return { ...c, include: !duplicate, duplicate };
      }));
      setSkipped(result.skipped.length);
      setStep('review');
    } catch (err) {
      setError(err instanceof TimetableImportError ? err.kind : 'failed');
      setStep('pick');
    }
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include && r.name.trim());

  const confirm = async () => {
    await onImport(chosen.map((r, i) => ({
      name: r.name.trim().slice(0, 80),
      instructor: r.instructor.trim() || undefined,
      notes: r.group ? t('imageImport.groupNote', { group: r.group }) : undefined,
      color: colorFor(existing.length + i),
      slots: r.slots.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, room: s.room })),
    })));
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('imageImport.title')}
      description={step === 'review' ? t('imageImport.reviewHint') : t('imageImport.description')}
      size="lg"
      footer={step === 'review' ? (
        <>
          <Button variant="secondary" className="flex-1" onClick={reset}>{t('imageImport.again')}</Button>
          <Button className="flex-1" disabled={!chosen.length} loading={importing} onClick={confirm}>{t('imageImport.addN', { count: chosen.length })}</Button>
        </>
      ) : (
        <Button variant="secondary" className="flex-1" onClick={close}>{t('common.cancel')}</Button>
      )}
    >
      {step === 'reading' ? (
        <div className="py-6" aria-live="polite">
          <LoadingMark compact label={t('imageImport.reading')} />
          {progress && progress.total > 0 ? (
            <div className="mx-auto mt-3 max-w-[16rem]">
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round((progress.done / progress.total) * 100)} aria-label={t('imageImport.reading')}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              <p className="tabular mt-1.5 text-center text-label text-muted">{Math.round((progress.done / progress.total) * 100)}%</p>
            </div>
          ) : (
            <p className="mt-2 text-center text-caption text-muted">{t('imageImport.readingHint')}</p>
          )}
        </div>
      ) : step === 'pick' ? (
        <div className="grid gap-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line px-4 py-8 text-center hover:border-primary/40">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ImagePlus className="h-6 w-6" /></span>
            <span className="text-body font-semibold text-ink">{t('imageImport.choose')}</span>
            <span className="text-caption text-muted">{t('imageImport.chooseHint')}</span>
            <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
          {error && (
            <p role="alert" className="flex gap-2 rounded-sm border border-danger/30 bg-danger/5 p-3 text-caption text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />{t(`imageImport.err.${error}`)}
            </p>
          )}
          <div className="flex gap-2 rounded-sm bg-sunken p-3 text-label text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p>{t('imageImport.privacy')}</p>
          </div>
          <button type="button" onClick={() => { close(); onUseCsv(); }} className="text-caption font-semibold text-link hover:underline">{t('imageImport.useCsv')}</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="flex items-center gap-1.5 text-caption text-muted"><Sparkles className="h-4 w-4 text-primary" aria-hidden />{t('imageImport.found', { count: rows.length })}</p>
          {skipped > 0 && <p role="note" className="rounded-sm bg-heritage/10 px-3 py-2 text-caption text-ink">{t('imageImport.skipped', { count: skipped })}</p>}
          <ul className="grid gap-2">
            {rows.map((r) => {
              const clashes = conflictsFor({ id: '', slots: r.slots.map((s, i) => ({ ...s, id: String(i) })) }, existing);
              return (
                <li key={r.key} className={cn('rounded-sm border bg-surface p-3', r.include ? 'border-line' : 'border-line opacity-60')}>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" className="mt-2.5 h-4 w-4 shrink-0" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })}
                      aria-label={t('imageImport.includeName', { name: r.name })} />
                    <div className="min-w-0 flex-1">
                      <label className="sr-only" htmlFor={`n-${r.key}`}>{t('imageImport.courseName')}</label>
                      <input id={`n-${r.key}`} className="field h-9 font-semibold" value={r.name} maxLength={80} onChange={(e) => update(r.key, { name: e.target.value })} />
                      <label className="sr-only" htmlFor={`i-${r.key}`}>{t('imageImport.instructor')}</label>
                      <input id={`i-${r.key}`} className="field mt-1.5 h-9 text-caption" value={r.instructor} maxLength={60} placeholder={t('imageImport.instructor')} onChange={(e) => update(r.key, { instructor: e.target.value })} />
                      <ul className="mt-2 grid gap-1">
                        {r.slots.map((s, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-caption text-ink">
                            <span className="tabular min-w-0 flex-1 truncate">
                              {WEEKDAY_LABELS[s.weekday]} {formatPeriods(Array.from({ length: s.toPeriod - s.fromPeriod + 1 }, (_, k) => s.fromPeriod + k))}
                              <span className="text-muted"> {s.startTime}–{s.endTime}{s.room ? ` · ${roomWithBuilding(s.room)}` : ''}</span>
                            </span>
                            {r.slots.length > 1 && (
                              <button type="button" aria-label={t('imageImport.removeSlot')} className="rounded-xs p-1 text-muted hover:text-danger"
                                onClick={() => update(r.key, { slots: r.slots.filter((_, k) => k !== i) })}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {r.duplicate && <p className="mt-1.5 text-label text-heritage">{t('imageImport.duplicate')}</p>}
                      {!r.duplicate && clashes.length > 0 && (
                        <p className="mt-1.5 text-label text-danger">{t('imageImport.clash', { name: clashes[0]!.course.name })}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
