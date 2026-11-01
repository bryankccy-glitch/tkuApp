import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { z } from 'zod';
import { isPushEndpoint } from './_pushHosts.js';

/** Public key only; never expose private VAPID, cron, or Supabase credentials. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: '不支援此操作。' });
    return;
  }
  const env = process.env;
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const url = env.SUPABASE_URL?.trim();
  const anon = env.SUPABASE_ANON_KEY?.trim();
  const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const configured = Boolean(publicKey && privateKey && url && anon && service && env.CRON_SECRET?.trim());
  if (req.method === 'GET') {
    res.status(200).json({ configured, publicKey: configured ? publicKey : null });
    return;
  }
  if (!configured || !publicKey || !privateKey || !url || !anon || !service) {
    res.status(503).json({ error: '伺服器推播尚未設定完成。' });
    return;
  }
  const token = typeof req.headers.authorization === 'string' ? req.headers.authorization.match(/^Bearer (\S+)$/)?.[1] : undefined;
  if (!token) { res.status(401).json({ error: '請先登入。' }); return; }
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const client = createClient(url, anon, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  try {
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) { res.status(401).json({ error: '請重新登入。' }); return; }
    const body = z.object({ endpoint: z.string().url().max(4096).refine(isPushEndpoint) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: '推播訂閱格式不正確。' }); return; }
    // RLS and an explicit owner predicate: never accept push keys supplied by the request.
    const { data: sub, error } = await client.from('push_subscriptions').select('endpoint,p256dh,auth')
      .eq('user_id', auth.user.id).eq('endpoint', body.data.endpoint).maybeSingle();
    if (error) throw error;
    if (!sub) { res.status(404).json({ error: '此裝置尚未完成推播訂閱，請重新連線。' }); return; }
    const admin = createClient(url, service, options);
    const id = `test:${Math.floor(Date.now() / 60_000)}`;
    const { error: claim } = await admin.from('push_sent').insert({ user_id: auth.user.id, reminder_id: id });
    if (claim?.code === '23505') { res.status(429).json({ error: '每分鐘最多測試一次，請稍後再試。' }); return; }
    if (claim) throw claim;
    webpush.setVapidDetails('https://tku-app.vercel.app/about', publicKey, privateKey);
    await webpush.sendNotification({ endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
      JSON.stringify({ title: 'TKU Campus OS 推播測試', body: '這則通知由伺服器傳送，上課提醒也使用這條推播路徑。', tag: id, url: '/me' }), { TTL: 60, urgency: 'high' });
    res.status(200).json({ sent: true });
  } catch {
    res.status(502).json({ error: '伺服器推播未能送出，請重新連線後再試。' });
  }
}
