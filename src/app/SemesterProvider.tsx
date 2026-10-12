import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSemesters } from '@/lib/hooks';
import type { Semester } from '@/lib/types';

const KEY = 'tku.semester';
interface Ctx {
  semester: Semester | null;
  semesters: Semester[];
  setSemesterId: (id: string) => void;
  loading: boolean;
}
const SemesterCtx = createContext<Ctx | null>(null);

export function SemesterProvider({ children }: { children: ReactNode }) {
  const { data: semesters = [], isLoading } = useSemesters();
  const [id, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (semesters.length && !semesters.some((s) => s.id === id)) setId(semesters[0]!.id);
  }, [semesters, id]);

  const setSemesterId = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  };

  const semester = semesters.find((s) => s.id === id) ?? semesters[0] ?? null;
  return <SemesterCtx.Provider value={{ semester, semesters, setSemesterId, loading: isLoading }}>{children}</SemesterCtx.Provider>;
}

export function useSemester() {
  const c = useContext(SemesterCtx);
  if (!c) throw new Error('useSemester outside SemesterProvider');
  return c;
}
