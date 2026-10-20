import { supabase } from '@/lib/supabase';
import type { ReminderPrefs } from './reminders';

/**
 * Web Push subscription for reminders that arrive while the app is closed (iOS 16.4+ home-screen
 * app, Android, desktop). The subscription and reminder settings are saved to push_subscriptions;
 * /api/push-reminders sends the notifications. Needs VITE_VAPID_PUBLIC_KEY at build time.
 */
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushAvailable(): boolean {
  return Boolean(VAPID && supabase && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);
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
export async function savePushSubscription(userId: string, prefs: ReminderPrefs): Promise<void> {
  if (!pushAvailable() || !supabase) throw new Error('push unavailable');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
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
}

/** Removes this device's subscription (server row first, then the browser subscription). */
export async function removePushSubscription(): Promise<void> {
  if (!pushAvailable() || !supabase) return;
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe().catch(() => false);
}
