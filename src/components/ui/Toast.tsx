import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastItem { id: number; message: string; tone: 'success' | 'error'; action?: { label: string; run: () => void } }
const Ctx = createContext<((t: Omit<ToastItem, 'id'>) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.action ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {items.map((t) => (
          <div key={t.id} className="anim-sheet pointer-events-auto flex max-w-md items-center gap-3 rounded-sm bg-[#162131] px-4 py-3 text-body text-white shadow-lift">
            {t.tone === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#7FD3A8]" /> : <AlertCircle className="h-5 w-5 shrink-0 text-[#F4A3A3]" />}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button type="button" className="font-semibold text-[#9CC4F0] hover:underline" onClick={() => { t.action!.run(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}
