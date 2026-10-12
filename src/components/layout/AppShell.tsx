import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/brand/Logo';
import { LoadingMark } from '@/components/brand/Logo';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav';
import { useAuth } from '@/app/AuthProvider';

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-sm px-3 text-body font-medium transition-colors',
          isActive ? 'bg-primary/[0.07] text-primary dark:bg-primary/15' : 'text-muted hover:bg-sunken hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-heritage" aria-hidden />}
          <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { mode } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
      <div className="px-3"><Wordmark /></div>
      <nav aria-label="主要導覽" className="mt-8 flex flex-col gap-0.5">
        {PRIMARY_NAV.map((i) => <SideLink key={i.to} item={i} />)}
      </nav>
      <div className="mx-3 my-4 h-px bg-line" />
      <nav aria-label="學習與機會" className="flex flex-col gap-0.5">
        {SECONDARY_NAV.map((i) => <SideLink key={i.to} item={i} />)}
      </nav>
      <div className="mt-auto px-3 text-[11px] leading-relaxed text-muted">
        {mode === 'local' && <p className="mb-2 rounded-xs bg-sunken px-2 py-1.5 text-ink">本機模式：資料只存在此瀏覽器</p>}
        <p>學生自主開發，非淡江大學官方 App。</p>
        <NavLink to="/about" className="underline-offset-2 hover:underline">關於與隱私</NavLink>
      </div>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav aria-label="主要導覽" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
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
                      <span className={cn('-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-canvas shadow-lift transition-colors', isActive ? 'bg-primary text-white ring-4 ring-primary/25 dark:text-[#2A0E0C]' : 'bg-primary/85 text-white dark:text-[#2A0E0C]')}>
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
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-sm bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">跳到主要內容</a>
      <Sidebar />
      <main id="main" ref={main} tabIndex={-1} className="min-w-0 flex-1 pb-28 outline-none lg:pb-10">
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

export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8', wide ? 'max-w-content' : 'max-w-3xl', className)}>{children}</div>;
}
