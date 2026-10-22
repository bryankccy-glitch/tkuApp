import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
const m = vi.hoisted(() => ({ save: vi.fn(), permission: 'granted', user: 'u1' as string | undefined }));
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ mode: 'cloud', session: m.user ? { user: { id: m.user } } : null }) }));
vi.mock('@/app/SemesterProvider', () => ({ useSemester: () => ({ semester: null }) }));
vi.mock('@/lib/hooks', () => ({ useCourses: () => ({ data: [] }), useTasks: () => ({ data: [] }) }));
vi.mock('@/services/pushSubscription', () => ({ pushAvailable: () => true, savePushSubscription: m.save }));
import { useReminderScheduler } from '../useReminderScheduler';
import { readPrefs, writePrefs } from '@/services/reminders';

describe('existing reminder settings upgrade', () => {
  beforeEach(() => {
    localStorage.clear();
    m.user = 'u1'; m.permission = 'granted';
    vi.stubGlobal('Notification', { get permission() { return m.permission; } });
    m.save.mockResolvedValue('https://push.example/owned');
    writePrefs({ enabled: true, classMinutes: 15, tasks: true });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it('repairs an old enabled setting without asking the user to toggle it off and on', async () => {
    renderHook(useReminderScheduler);
    await waitFor(() => expect(readPrefs().push).toBe(true));
    expect(m.save).toHaveBeenCalledWith('u1', expect.objectContaining({ enabled: true, classMinutes: 15 }));
  });
  it('rechecks even if a stale local flag claimed push was already enabled', async () => {
    writePrefs({ ...readPrefs(), push: true });
    m.save.mockRejectedValue(new Error('server unreachable'));
    renderHook(useReminderScheduler);
    await waitFor(() => expect(readPrefs().push).toBe(false));
  });
  it('never requests permission or subscribes for guests or ungranted permission', () => {
    m.permission = 'default';
    const first = renderHook(useReminderScheduler);
    expect(m.save).not.toHaveBeenCalled();
    first.unmount(); m.permission = 'granted'; m.user = undefined;
    renderHook(useReminderScheduler);
    expect(m.save).not.toHaveBeenCalled();
  });
  it('does not re-enable reminders if the user disables them during reconnect', async () => {
    let finish: (value: string) => void = () => {};
    m.save.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    renderHook(useReminderScheduler);
    writePrefs({ ...readPrefs(), enabled: false });
    finish('https://push.example/owned');
    await waitFor(() => expect(readPrefs().enabled).toBe(false));
    expect(readPrefs().push).not.toBe(true);
  });
});
