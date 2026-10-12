import { cn } from '@/lib/cn';

const base = import.meta.env.BASE_URL;
const src = (size: 128 | 256 | 512) => `${base}brand/logo-${size}.png`;

/**
 * TKU Campus OS 標誌：宮燈教室建築、書卷曲線、淡水夕照與 TKU 字標。
 * 開發者提供的原創設計（design/brand/），非淡江大學官方校徽。
 */
export function LogoMark({ className, title = 'TKU Campus OS' }: { className?: string; title?: string }) {
  return (
    <img
      src={src(128)}
      srcSet={`${src(128)} 1x, ${src(256)} 2x, ${src(512)} 4x`}
      alt={title}
      width={36}
      height={36}
      decoding="async"
      className={cn('h-9 w-9 shrink-0 rounded-[22%] shadow-[0_0_0_1px_rgb(0_0_0/0.06)]', className)}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="h-10 w-10" />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-ink">TKU Campus OS</span>
        <span className="block text-[11px] font-medium tracking-[0.12em] text-muted">淡江智慧校園</span>
      </span>
    </span>
  );
}

/** Loading mark: the logo breathes gently (static under reduced motion). */
export function LoadingMark({ label = '載入中' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-muted">
      <img
        src={src(128)}
        srcSet={`${src(128)} 1x, ${src(256)} 2x`}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 rounded-[22%] motion-safe:animate-[breathe_1.6s_ease-in-out_infinite]"
      />
      <span className="text-caption">{label}</span>
      <style>{`@keyframes breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.94);opacity:.75}}`}</style>
    </div>
  );
}
