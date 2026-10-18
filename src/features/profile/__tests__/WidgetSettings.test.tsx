import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { db } = vi.hoisted(() => {
  const inserted: { user_id: string; token_hash: string }[] = [];
  const chain = {
    select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }),
    delete: () => ({ eq: async () => ({ error: null }) }),
    insert: async (row: { user_id: string; token_hash: string }) => { inserted.push(row); return { error: null }; },
  };
  return { db: { inserted, from: vi.fn(() => chain) } };
});
vi.mock('@/lib/supabase', () => ({ supabase: { from: db.from }, isCloudConfigured: true }));
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ mode: 'cloud', session: { user: { id: 'u1' } } }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));

import { WidgetSettings, sha256Hex } from '../WidgetSettings';
import { buildWidgetScript } from '../widgetScript';

describe('WidgetSettings', () => {
  it('creates a token, stores only its hash, and offers the script to copy', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<WidgetSettings />);
    await user.click(await screen.findByRole('button', { name: '產生小工具' }));
    await user.click(await screen.findByRole('button', { name: '複製小工具程式' }));
    const script = writeText.mock.calls[0]![0];
    const token = script.match(/const TOKEN = "([^"]+)"/)![1]!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(db.inserted).toEqual([{ user_id: 'u1', token_hash: await sha256Hex(token) }]);
    expect(db.inserted[0]!.token_hash).not.toContain(token);
  });

  it('builds a script pointing at this site', () => {
    const s = buildWidgetScript('tok', 'https://tku-app.vercel.app');
    expect(s).toContain('const ORIGIN = "https://tku-app.vercel.app"');
    expect(s).toContain('ORIGIN + "/api/widget"');
  });
});
