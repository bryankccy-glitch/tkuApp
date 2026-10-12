import { cn } from '@/lib/cn';

/**
 * 宮燈廊柱帶：以宮燈教室的拱窗節奏繪製的原創剪影，用於首頁歡迎區底部。
 * 純裝飾，aria-hidden。
 */
export function Colonnade({ className, arches = 14 }: { className?: string; arches?: number }) {
  const w = 40;
  const total = arches * w;
  return (
    <svg
      viewBox={`0 0 ${total} 64`}
      preserveAspectRatio="xMidYMax slice"
      className={cn('pointer-events-none block w-full', className)}
      aria-hidden
    >
      {/* roof line with upturned eaves */}
      <path d={`M0 10 Q${total / 2} 4 ${total} 10 V16 H0Z`} fill="currentColor" />
      {Array.from({ length: arches }).map((_, i) => {
        const x = i * w;
        return (
          <g key={i}>
            <path
              d={`M${x} 16 H${x + w} V64 H${x + w - 6} V34 a14 14 0 0 0 -28 0 V64 H${x}Z`}
              fill="currentColor"
            />
            <line x1={x + w / 2} y1={20} x2={x + w / 2} y2={27} stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
            <rect x={x + w / 2 - 3} y={27} width="6" height="8" rx="3" fill="#F2C46B" />
          </g>
        );
      })}
    </svg>
  );
}

/** 書卷曲線：用於空狀態插畫。 */
export function ScrollIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 96" className={cn('h-20 w-auto', className)} aria-hidden>
      <path d="M18 70c18-26 44-38 62-30s44 4 62-20" fill="none" className="stroke-link/40" strokeWidth="10" strokeLinecap="round" />
      <path d="M18 78c18-26 44-38 62-30s44 4 62-20" fill="none" className="stroke-primary/70" strokeWidth="3" strokeLinecap="round" />
      <circle cx="18" cy="74" r="9" className="fill-surface stroke-primary/70" strokeWidth="3" />
      <circle cx="142" cy="24" r="9" className="fill-surface stroke-primary/70" strokeWidth="3" />
      <rect x="76" y="30" width="8" height="11" rx="4" className="fill-heritage" />
    </svg>
  );
}
