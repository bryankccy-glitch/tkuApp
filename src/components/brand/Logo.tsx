import { retryShortViewport } from '@/lib/iosShortViewport';
import { cn } from '@/lib/cn';
import { useLayoutEffect, useState } from 'react';
import { t } from '@/i18n/t';
import { holdSplash, splashShowing } from '@/lib/splash';

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
        <span className="block text-[11px] font-medium tracking-[0.12em] text-muted">{t('brand.subtitle')}</span>
      </span>
    </span>
  );
}

/**
 * Full-screen loading. While the HTML boot splash is still up it just keeps it up (renders nothing),
 * so the splash fades out only once the real screen is ready. If the splash is already gone, it
 * renders the same look in React.
 */
export function BootScreen({ label = t('common.loading') }: { label?: string }) {
  const [overlay] = useState(splashShowing);
  useLayoutEffect(() => (overlay ? holdSplash() : undefined), [overlay]);
  // While this full-screen splash is up, paint everything around the page splash-colored too — on iOS a
  // strip below the page (outside it) shows the html background and would otherwise be the light canvas.
  useLayoutEffect(() => {
    if (overlay) return undefined;
    const root = document.documentElement;
    root.classList.add('boot-screen');
    return () => {
      root.classList.remove('boot-screen');
      retryShortViewport();
    };
  }, [overlay]);
  if (overlay) return null;
  return (
    <div className="splash splash--static" role="status" aria-label={label}>
      <img className="splash-logo" src={src(256)} width={112} height={112} alt="" />
      <p className="splash-title">TKU Campus OS</p>
      <p className="splash-sub">{t('brand.subtitle')}</p>
      <div className="splash-bar" aria-hidden="true"><span /></div>
      <p className="splash-tag">One Campus. One OS.</p>
    </div>
  );
}

/**
 * In-page loading: logo inside a spinning brand-red ring. Fades in after a short delay so
 * fast loads don't flash; static under reduced motion. `compact` for small sections (sheets, comments).
 */
export function LoadingMark({ label = t('common.loading'), compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" className={cn('loading-in flex flex-col', compact ? 'min-h-[180px]' : 'min-h-[55vh]', 'items-center justify-center gap-3.5 py-10 text-muted')}>
      <div className="relative h-16 w-16">
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-[3px] border-primary/15 border-t-primary motion-safe:animate-spin [animation-duration:900ms]" />
        <img
          src={src(128)}
          srcSet={`${src(128)} 1x, ${src(256)} 2x`}
          alt=""
          width={40}
          height={40}
          className="absolute inset-3 h-10 w-10 rounded-[22%] shadow-[0_2px_8px_-2px_rgb(0_0_0/0.25)]"
        />
      </div>
      <span className="text-caption font-medium tracking-wide">{label}</span>
    </div>
  );
}
