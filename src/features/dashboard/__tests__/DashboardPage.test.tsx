import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import { renderApp } from '@/test/renderApp';
import { LocalRepository } from '@/lib/data/local';
import { memoryStorage } from '@/test/memoryStorage';
import { weekdayOf } from '@/lib/time';

describe('DashboardPage', () => {
  it('shows an empty next-class state with a working add link', async () => {
    renderApp([{ path: '/', element: <DashboardPage /> }], '/');
    expect(await screen.findByText('這週沒有排課')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新增課程' })).toHaveAttribute('href', '/schedule?add=1');
  });

  it('renders stored profile, today classes and tasks', async () => {
    const repo = new LocalRepository(memoryStorage());
    await repo.updateProfile({ displayName: '小淡' });
    const [sem] = await repo.listSemesters();
    const today = weekdayOf(new Date());
    await repo.upsertCourse({ semesterId: sem!.id, name: '深夜程式設計', color: 'violet', slots: [{ weekday: today, startTime: '23:00', endTime: '23:59', room: 'E101' }] });
    const due = new Date(); due.setHours(23, 58, 0, 0);
    await repo.upsertTask({ title: '交作業', kind: 'homework', dueAt: due.toISOString(), priority: 'medium', completed: false, remindMinutesBefore: null });

    renderApp([{ path: '/', element: <DashboardPage /> }], '/', repo);
    expect(await screen.findByRole('heading', { name: /小淡/ })).toBeInTheDocument();
    expect(screen.getAllByText('深夜程式設計').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1 堂課/)).toBeInTheDocument();
    expect(screen.getByText('交作業')).toBeInTheDocument();
    expect(screen.getByText('工學大樓')).toBeInTheDocument();
  });
});
