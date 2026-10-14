import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from '../SchedulePage';
import { renderApp } from '@/test/renderApp';
import { calendarEventSchema } from '../CalendarEventForm';

describe('student calendar UI', () => {
  it('adds, edits and removes a private work event and opens year / month views with no courses', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp([{ path: '/schedule', element: <SchedulePage /> }], '/schedule');
    await user.click(await screen.findByRole('tab', { name: '月' }));
    await user.click(await screen.findByRole('button', { name: '新增行程' }));
    let form = await screen.findByRole('dialog', { name: '新增行程' });
    await user.type(within(form).getByLabelText('行程名稱'), '測試排班');
    await user.selectOptions(within(form).getByLabelText('行程類型'), 'work');
    await user.click(within(form).getByRole('button', { name: '儲存變更' }));
    await user.click(await screen.findByRole('button', { name: '測試排班' }));
    form = await screen.findByRole('dialog', { name: '編輯行程' });
    await user.clear(within(form).getByLabelText('行程名稱'));
    await user.type(within(form).getByLabelText('行程名稱'), '修改後排班');
    await user.click(within(form).getByRole('button', { name: '儲存變更' }));
    expect(await screen.findByRole('button', { name: '修改後排班' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '刪除' }));
    const confirm = await screen.findByRole('dialog', { name: '刪除行程' });
    await user.click(within(confirm).getByRole('button', { name: '刪除' }));
    expect(await screen.findByText('行程已刪除')).toBeInTheDocument();
    expect(await repo.listCalendarEvents()).toEqual([]);
    await user.click(screen.getByRole('tab', { name: '年' }));
    await user.click(await screen.findByRole('button', { name: /12 月 0 個行程/ }));
    expect(await screen.findByText(/年 12 月/)).toBeInTheDocument();
  });
  it('rejects invalid dates, reversed ranges and impossible weekly ranges', () => {
    const value = { title: '排班', kind: 'work', startDate: '2026-10-13', endDate: '2026-10-13', startTime: '18:00', endTime: '20:00', location: '', notes: '', repeat: 'none', repeatUntil: '' };
    expect(calendarEventSchema.safeParse(value).success).toBe(true);
    expect(calendarEventSchema.safeParse({ ...value, startDate: '2026-02-30' }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...value, endTime: '17:00' }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...value, repeat: 'weekly', endDate: '2026-11-13' }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...value, repeat: 'weekly', repeatUntil: '2026-10-01' }).success).toBe(false);
  });
});
