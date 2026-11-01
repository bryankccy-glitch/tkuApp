/**
 * Web Push providers the server may contact. A subscription is user-supplied, so without this list
 * a signed-in user could make the server send requests to any HTTPS address.
 * The underscore keeps this file from becoming a Vercel function.
 */
const EXACT = ['fcm.googleapis.com', 'android.googleapis.com'];
const SUFFIX = ['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'];

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return EXACT.includes(url.hostname) || SUFFIX.some((end) => url.hostname.endsWith(end));
}
