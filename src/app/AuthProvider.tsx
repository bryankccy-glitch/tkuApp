import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LocalRepository } from '@/lib/data/local';
import { SupabaseRepository } from '@/lib/data/supabaseRepo';
import type { DataRepository } from '@/lib/data/repository';

interface AuthState {
  /** 'local' = Supabase not configured; data stays in this browser. */
  mode: 'local' | 'cloud';
  loading: boolean;
  session: Session | null;
  repo: DataRepository | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const localRepo = new LocalRepository();

/** `localRepository` lets tests inject an isolated store; the app uses the shared default. */
export function AuthProvider({ children, localRepository = localRepo }: { children: ReactNode; localRepository?: DataRepository }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    if (!supabase) {
      return { mode: 'local', loading: false, session: null, repo: localRepository, signOut: async () => {} };
    }
    const client = supabase;
    return {
      mode: 'cloud',
      loading,
      session,
      repo: session ? new SupabaseRepository(client, session.user.id) : null,
      signOut: async () => {
        await client.auth.signOut();
      },
    };
  }, [session, loading, localRepository]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Repository for the signed-in user. Only call inside routes guarded by RequireAuth. */
export function useRepo(): DataRepository {
  const { repo } = useAuth();
  if (!repo) throw new Error('No repository: user is not signed in');
  return repo;
}
