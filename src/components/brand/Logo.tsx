import { cn } from '@/lib/cn';

/**
 * TKU Campus OS mark — 「宮燈拱窗」：
 * 拱形窗框取自宮燈教室的窗廊節奏，懸掛的紅色宮燈為視覺焦點，
 * 底部波線同時暗示書卷曲線與淡水河。原創設計，未使用淡江官方校徽。
 */
export function LogoMark({ className, title = 'TKU Campus OS' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9 shrink-0', className)} role="img" aria-label={title}>
      <rect width="64" height="64" rx="15" className="fill-[#15345A] dark:fill-[#203F66]" />
      <path d="M20 49V30a12 12 0 0 1 24 0v19" fill="none" stroke="#F8F6F1" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M32 18v9" stroke="#F8F6F1" strokeWidth="2" strokeLinecap="round" />
      <rect x="28.5" y="27" width="7" height="9" rx="3.5" fill="#D9675F" />
      <path d="M11 50c8-5 15-5 21 0s13 5 21 0" fill="none" stroke="#7FB2EA" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-navy">TKU Campus OS</span>
        <span className="block text-[11px] font-medium tracking-[0.12em] text-muted">淡江智慧校園</span>
      </span>
    </span>
  );
}

/** Loading mark: the lantern sways gently (disabled under reduced motion). */
export function LoadingMark({ label = '載入中' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-muted">
      <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden>
        <path d="M20 49V30a12 12 0 0 1 24 0v19" fill="none" className="stroke-navy" strokeWidth="4" strokeLinecap="round" />
        <g className="origin-[32px_18px] motion-safe:animate-[sway_1.6s_ease-in-out_infinite]">
          <path d="M32 18v9" className="stroke-navy" strokeWidth="2" strokeLinecap="round" />
          <rect x="28.5" y="27" width="7" height="9" rx="3.5" className="fill-heritage" />
        </g>
      </svg>
      <span className="text-caption">{label}</span>
      <style>{`@keyframes sway{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}`}</style>
    </div>
  );
}
