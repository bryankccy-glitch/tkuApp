import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LocalRepository } from '@/lib/data/local';
import { SupabaseRepository } from '@/lib/data/supabaseRepo';
import type { DataRepository } from '@/lib/data/repository';

interface AuthState {
  /** 'local' = data stays in this browser (Supabase not configured, or the user chose guest). */
  mode: 'local' | 'cloud';
  /** True when a Supabase project is configured, i.e. signing in is possible. */
  cloudAvailable: boolean;
  /** Cloud is available but the user chose to continue without an account. */
  isGuest: boolean;
  loading: boolean;
  session: Session | null;
  repo: DataRepository | null;
  continueAsGuest: () => void;
  /** Signs out of the account, or leaves guest mode (local data is kept). */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const localRepo = new LocalRepository();
const GUEST_KEY = 'tku.guest';

function readGuest() {
  try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; }
}
function writeGuest(on: boolean) {
  try { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); } catch { /* storage unavailable */ }
}

/** `localRepository` lets tests inject an isolated store; the app uses the shared default. */
export function AuthProvider({ children, localRepository = localRepo }: { children: ReactNode; localRepository?: DataRepository }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [guest, setGuest] = useState(readGuest);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Signing in ends guest mode.
      if (s) { writeGuest(false); setGuest(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const continueAsGuest = useCallback(() => { writeGuest(true); setGuest(true); }, []);

  const value = useMemo<AuthState>(() => {
    if (!supabase) {
      return { mode: 'local', cloudAvailable: false, isGuest: false, loading: false, session: null, repo: localRepository, continueAsGuest, signOut: async () => {} };
    }
    const client = supabase;
    if (!session && guest) {
      return {
        mode: 'local', cloudAvailable: true, isGuest: true, loading, session: null, repo: localRepository, continueAsGuest,
        signOut: async () => { writeGuest(false); setGuest(false); },
      };
    }
    return {
      mode: 'cloud',
      cloudAvailable: true,
      isGuest: false,
      loading,
      session,
      repo: session ? new SupabaseRepository(client, session.user.id) : null,
      continueAsGuest,
      signOut: async () => {
        await client.auth.signOut();
      },
    };
  }, [session, loading, guest, localRepository, continueAsGuest]);

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
