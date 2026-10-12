import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ScrollIllustration } from '@/components/brand/Colonnade';

export function EmptyState({ title, body, action, compact }: { title: string; body?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-6' : 'py-12')}>
      {!compact && <ScrollIllustration className="mb-4" />}
      <p className="text-h3 text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-caption text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto rounded-sm bg-sunken p-1 [scrollbar-width:none]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-8 shrink-0 items-center gap-1.5 rounded-xs px-3 text-caption font-semibold transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="tabular rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-h1 text-ink">{title}</h1>
        {subtitle && <div className="mt-1 text-body text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 id={id} className="text-h3 text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : '發生未知錯誤';
  return (
    <div role="alert" className="rounded-sm border border-danger/30 bg-danger/5 p-4 text-body text-ink">
      <p className="font-semibold text-danger">資料載入失敗</p>
      <p className="mt-1 text-caption text-muted">{msg}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-2 text-caption font-semibold text-link hover:underline">重新載入</button>}
    </div>
  );
}
