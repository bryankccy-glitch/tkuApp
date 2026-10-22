import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), getSubscription: vi.fn(), subscribe: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ upsert: mocks.upsert }), auth: { getSession: mocks.getSession } } }));
import { pushAvailable, savePushSubscription, testPushSubscription } from '../pushSubscription';

describe('push subscription upgrade', () => {
  const key = btoa(String.fromCharCode(4, ...Array<number>(64).fill(1))).replace(/=/g, '');
  beforeEach(() => {
    vi.stubGlobal('PushManager', class {});
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: mocks }) } });
    mocks.getSubscription.mockResolvedValue(null);
    mocks.subscribe.mockResolvedValue({ toJSON: () => ({ endpoint: 'https://push.example/owned', keys: { p256dh: 'public', auth: 'subscription-secret' } }) });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'user-jwt' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ configured: true, publicKey: key }))));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it('works without a build-time VAPID key and persists the device and preferences', async () => {
    expect(pushAvailable()).toBe(true);
    await savePushSubscription('u1', { enabled: true, classMinutes: 10, tasks: true });
    expect(mocks.subscribe).toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', class_minutes: 10, tasks: true }), { onConflict: 'endpoint' });
  });
  it('refuses to report a subscription when the server is not configured', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ configured: false, publicKey: null })));
    await expect(savePushSubscription('u1', { enabled: true, classMinutes: 10, tasks: true })).rejects.toThrow();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('tests server push with the user JWT, not just a local notification', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ configured: true, publicKey: key }))).mockResolvedValueOnce(new Response('{}'));
    await testPushSubscription('u1', { enabled: true, classMinutes: 15, tasks: false });
    expect(fetch).toHaveBeenLastCalledWith('/api/push', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer user-jwt' }), body: JSON.stringify({ endpoint: 'https://push.example/owned' }) }));
  });
  it('does not report success if RLS/storage rejects subscription saving', async () => {
    mocks.upsert.mockResolvedValue({ error: { message: 'denied' } });
    await expect(savePushSubscription('u1', { enabled: true, classMinutes: 10, tasks: true })).rejects.toThrow('denied');
  });
});
