import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const m = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn(), send: vi.fn(), eq: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: m.getUser }, from: () => ({ select: () => ({ eq: m.eq }), insert: m.insert }) }) }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: m.send } }));
import handler from '../push';
async function request(method = 'POST', token = 'Bearer jwt', body: unknown = { endpoint: 'https://push.example/owned' }) {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ method, headers: { authorization: token }, body } as VercelRequest, res as unknown as VercelResponse);
  return res;
}
describe('push config and owned-device test', () => {
  beforeEach(() => {
    for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET']) vi.stubEnv(key, key);
    m.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    m.eq.mockReturnValue({ eq: m.eq, maybeSingle: m.maybeSingle });
    m.maybeSingle.mockResolvedValue({ data: { endpoint: 'https://push.example/owned', p256dh: 'p', auth: 'a' }, error: null });
    m.insert.mockResolvedValue({ error: null });
    m.send.mockResolvedValue({});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it('exposes only readiness and the PUBLIC VAPID key', async () => {
    const res = await request('GET');
    expect(res.json).toHaveBeenCalledWith({ configured: true, publicKey: 'VAPID_PUBLIC_KEY' });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('PRIVATE');
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('SERVICE_ROLE');
  });
  it('reports missing server configuration honestly', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await request('GET')).json).toHaveBeenCalledWith({ configured: false, publicKey: null });
    expect((await request()).status).toHaveBeenCalledWith(503);
  });
  it('rejects missing/invalid JWT and another owner’s endpoint', async () => {
    expect((await request('POST', '')).status).toHaveBeenCalledWith(401);
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await request()).status).toHaveBeenCalledWith(401);
    m.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await request()).status).toHaveBeenCalledWith(404);
    expect(m.send).not.toHaveBeenCalled();
  });
  it('validates, sends only stored subscription keys, and rate limits per user', async () => {
    expect((await request('POST', 'Bearer jwt', { endpoint: 'http://bad' })).status).toHaveBeenCalledWith(400);
    expect((await request()).status).toHaveBeenCalledWith(200);
    expect(m.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(m.send).toHaveBeenCalledWith({ endpoint: 'https://push.example/owned', keys: { p256dh: 'p', auth: 'a' } }, expect.any(String), expect.any(Object));
    m.insert.mockResolvedValueOnce({ error: { code: '23505' } });
    expect((await request()).status).toHaveBeenCalledWith(429);
  });
  it('does not leak upstream failures', async () => {
    m.send.mockRejectedValueOnce(new Error('private-provider-detail'));
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('private-provider-detail');
  });
});
