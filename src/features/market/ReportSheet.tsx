import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { REPORT_REASONS, type ReportReason } from '@/lib/social/types';
import { t } from '@/i18n/t';

export function ReportSheet({ open, onClose, subject, onSubmit }: { open: boolean; onClose: () => void; subject: string; onSubmit: (r: ReportReason, note?: string) => void }) {
  const [reason, setReason] = useState<ReportReason>('prohibited');
  const [note, setNote] = useState('');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('market.reportTitle')}
      description={subject}
      size="sm"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" className="flex-1" onClick={() => onSubmit(reason, note)}>{t('market.reportSend')}</Button>
        </>
      }
    >
      <fieldset>
        <legend className="label">{t('market.reportReason')}</legend>
        <div className="grid gap-1.5">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2.5 rounded-sm border border-line px-3 py-2.5 text-body text-ink has-[:checked]:border-primary">
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4" />
              {t(`market.reason.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="report-note" className="label mt-3">{t('market.reportNote')}</label>
      <textarea id="report-note" rows={2} maxLength={500} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
    </Sheet>
  );
}
