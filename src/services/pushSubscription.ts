import { supabase } from '@/lib/supabase';
import type { ReminderPrefs } from './reminders';

/**
 * Web Push subscription for reminders that arrive while the app is closed (iOS 16.4+ home-screen
 * app, Android, desktop). The subscription and reminder settings are saved to push_subscriptions;
 * /api/push-reminders sends the notifications. Needs VITE_VAPID_PUBLIC_KEY at build time.
 */
export function pushAvailable(): boolean {
  return Boolean(supabase && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('service worker not ready')), 8000)),
  ]);
}

/** Subscribes (or reuses the existing subscription) and saves it with the current settings. */
export async function savePushSubscription(userId: string, prefs: ReminderPrefs): Promise<string> {
  if (!pushAvailable() || !supabase) throw new Error('push unavailable');
  // Fetch at runtime: old installs/builds may not contain VITE_VAPID_PUBLIC_KEY.
  const response = await fetch('/api/push', { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  const config = await response.json() as { configured?: boolean; publicKey?: string };
  if (!response.ok || !config.configured || !config.publicKey) throw new Error('push not configured');
  const key = keyBytes(config.publicKey);
  if (key.length !== 65 || key[0] !== 4) throw new Error('invalid public key');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('incomplete subscription');
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    user_id: userId,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    class_minutes: prefs.classMinutes,
    tasks: prefs.tasks,
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
  return json.endpoint;
}

/** Tests the same server → push service → service worker path as scheduled reminders. */
export async function testPushSubscription(userId: string, prefs: ReminderPrefs): Promise<void> {
  const endpoint = await savePushSubscription(userId, prefs);
  const session = await supabase!.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('not signed in');
  const response = await fetch('/api/push', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('push test failed');
}

const PENDING_REMOVAL = 'tku.push.pendingRemoval';

function pendingRemoval(): string | null {
  try { return localStorage.getItem(PENDING_REMOVAL); } catch { return null; }
}

function rememberRemoval(endpoint: string) {
  try { localStorage.setItem(PENDING_REMOVAL, endpoint); } catch { /* storage unavailable */ }
}

async function boundedCleanup(work: () => Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('push cleanup timed out')), 5000); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function deleteEndpoint(endpoint: string): Promise<void> {
  if (!supabase) throw new Error('push storage unavailable');
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

function clearPending(endpoint: string) {
  try { if (pendingRemoval() === endpoint) localStorage.removeItem(PENDING_REMOVAL); } catch { /* storage unavailable */ }
}

/** Retry server cleanup even on browsers without PushManager support. */
export async function retryPendingPushRemoval(): Promise<void> {
  const endpoint = pendingRemoval();
  if (!endpoint) return;
  await boundedCleanup(async () => {
    // The browser subscription may still exist when unsubscribe previously failed.
    const sub = pushAvailable()
      ? await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      : null;
    const results = await Promise.allSettled([
      deleteEndpoint(endpoint),
      sub?.endpoint === endpoint ? sub.unsubscribe().then((ok) => {
        if (!ok) throw new Error('push unsubscribe failed');
      }) : Promise.resolve(),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    clearPending(endpoint);
  });
}

/** Persist the endpoint before cleanup so timeouts and sign-out cannot lose it. */
export async function removePushSubscription(): Promise<void> {
  await boundedCleanup(async () => {
    if (!pushAvailable()) {
      await retryPendingPushRemoval();
      return;
    }
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!sub) {
      await retryPendingPushRemoval();
      return;
    }
    const endpoint = sub.endpoint;
    rememberRemoval(endpoint);
    const results = await Promise.allSettled([
      deleteEndpoint(endpoint),
      sub.unsubscribe().then((ok) => {
        if (!ok) throw new Error('push unsubscribe failed');
      }),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    clearPending(endpoint);
  });
}
