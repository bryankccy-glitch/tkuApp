import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => ({ removePushSubscription: vi.fn(), retryPendingPushRemoval: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/pushSubscription', () => push);

const { auth } = vi.hoisted(() => ({ auth: {
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getSession: vi.fn(() => new Promise(() => {})), // never settles (slow network / stuck lock)
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
} }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth }, isCloudConfigured: true }));

import { AuthProvider, useAuth } from '../AuthProvider';

function Probe() {
  const { loading, signOut } = useAuth();
  return <><p>{loading ? 'loading' : 'ready'}</p><button onClick={() => { void signOut(); }}>logout</button></>;
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
  it('completes sign-out when push cleanup fails', async () => {
    push.removePushSubscription.mockRejectedValueOnce(new Error('offline'));
    render(<AuthProvider><Probe /></AuthProvider>);
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  });

});
