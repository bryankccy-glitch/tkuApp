import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { LoadingMark } from '@/components/brand/Logo';
import { PRIMARY_NAV } from './nav';

function BottomNav() {
  return (
    <nav aria-label="主要導覽" className="safe-bottom fixed bottom-0 left-1/2 z-40 w-full max-w-app -translate-x-1/2 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="grid h-16 grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-muted')
                }
              >
                {({ isActive }) =>
                  item.primary ? (
                    <>
                      <span className={cn('-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-canvas shadow-lift transition-colors', isActive ? 'bg-primary text-white ring-4 ring-primary/25 dark:text-[#1A0506]' : 'bg-primary/85 text-white dark:text-[#1A0506]')}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <span>{item.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="relative">
                        <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.9} />
                      </span>
                      <span>{item.label}</span>
                      <span className={cn('h-1 w-1 rounded-full', isActive ? 'bg-heritage' : 'bg-transparent')} aria-hidden />
                    </>
                  )
                }
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app-frame relative mx-auto min-h-dvh w-full max-w-app bg-canvas">
      <a href="#main" className="sr-only z-50 rounded-sm bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">跳到主要內容</a>
      <main id="main" ref={main} tabIndex={-1} className="min-w-0 pb-28 outline-none">
        {import.meta.env.VITE_PREVIEW_DEMO === '1' && (
          <p className="bg-primary/[0.07] px-4 py-2 text-center text-caption text-ink">預覽版：已放入範例課程與待辦，資料只存在這個瀏覽器。可以自由新增、編輯、刪除。</p>
        )}
        <Suspense fallback={<LoadingMark />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

/** Page content inside the phone frame. `wide` is kept for API compatibility; the frame sets the width. */
export function Page({ children, className }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('w-full px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]', className)}>{children}</div>;
}
