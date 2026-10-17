import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { auth } = vi.hoisted(() => ({ auth: {
  getSession: vi.fn(() => new Promise(() => {})), // never settles (slow network / stuck lock)
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
} }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth }, isCloudConfigured: true }));

import { AuthProvider, useAuth } from '../AuthProvider';

function Probe() {
  const { loading } = useAuth();
  return <p>{loading ? 'loading' : 'ready'}</p>;
}

describe('AuthProvider', () => {
  afterEach(() => vi.useRealTimers());

  it('stops waiting for the sign-in check after a few seconds instead of loading forever', () => {
    vi.useFakeTimers();
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6100); });
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
