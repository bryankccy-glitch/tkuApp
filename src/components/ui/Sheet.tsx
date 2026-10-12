import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';

/**
 * Modal sheet: bottom sheet on phones, centered dialog on ≥ sm.
 * Traps focus, closes on Esc / backdrop, restores focus to the opener.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // Read the latest onClose without re-running the open effect: callers often pass a new
  // function each render, and re-running would steal focus from the field being typed in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? panel.current)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const a = f[0]!;
        const z = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="anim-fade absolute inset-0 bg-[#0B1626]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'anim-sheet relative flex max-h-[92dvh] w-full max-w-app flex-col rounded-t-xl bg-surface shadow-sheet',
          size === 'sm' && '',
          size === 'md' && '',
          size === 'lg' && '',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
        <header className="flex items-start gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-h3 text-ink">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-caption text-muted">{description}</p>}
          </div>
          <button data-close type="button" onClick={onClose} aria-label={t('common.close')} className="-mr-2 rounded-sm p-2 text-muted hover:bg-sunken hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <footer className="safe-bottom flex gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({
  open, onClose, onConfirm, title, message, confirmLabel, danger = true, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 flex-1 rounded-sm border border-line font-semibold text-ink hover:bg-sunken">{t('common.cancel')}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn('h-10 flex-1 rounded-sm font-semibold text-white disabled:opacity-50', danger ? 'bg-danger' : 'bg-primary')}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-body text-muted">{message}</p>
    </Sheet>
  );
}
