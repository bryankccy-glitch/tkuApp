import { describe, expect, it } from 'vitest';
import { isPushEndpoint } from '../_pushHosts';

describe('isPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QOabc',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
  ])('accepts %s', (value) => expect(isPushEndpoint(value)).toBe(true));

  it.each([
    'https://evil.example/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x',
    'https://evilpush.apple.com/x',
    'https://push.apple.com.evil.example/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'not a url',
  ])('refuses %s', (value) => expect(isPushEndpoint(value)).toBe(false));
});
