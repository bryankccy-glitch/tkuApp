import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksPage from '../TasksPage';
import { renderApp } from '@/test/renderApp';
import { LocalRepository } from '@/lib/data/local';
import { memoryStorage } from '@/test/memoryStorage';

const routes = [{ path: '/tasks', element: <TasksPage /> }];

describe('TasksPage', () => {
  it('creates, completes, edits and deletes a task', async () => {
    const user = userEvent.setup();
    const repo = new LocalRepository(memoryStorage());
    renderApp(routes, '/tasks', repo);

    // create (default due: tomorrow 23:59 → shows in 本週 unless tomorrow is next week; use 全部)
    await user.click(await screen.findByRole('tab', { name: '全部' }));
    await user.click(screen.getByRole('button', { name: '新增' }));
    const dialog = await screen.findByRole('dialog', { name: '新增作業或考試' });
    await user.type(within(dialog).getByLabelText('標題'), '第三章習題');
    await user.selectOptions(within(dialog).getByLabelText('類型'), 'quiz');
    await user.click(within(dialog).getByRole('button', { name: '新增' }));
    expect(await screen.findByText('第三章習題')).toBeInTheDocument();
    const stored = await repo.listTasks();
    expect(stored[0]!.kind).toBe('quiz');
    expect(stored[0]!.remindMinutesBefore).toBe(1440);

    // complete
    await user.click(screen.getByRole('checkbox', { name: '標記為已完成：第三章習題' }));
    await waitFor(async () => expect((await repo.listTasks())[0]!.completed).toBe(true));

    // edit
    await user.click(screen.getByRole('button', { name: '編輯' }));
    const edit = await screen.findByRole('dialog', { name: '編輯待辦' });
    const title = within(edit).getByLabelText('標題');
    await user.clear(title);
    await user.type(title, '第三章習題（更正）');
    await user.click(screen.getByRole('button', { name: '儲存變更' }));
    expect(await screen.findByText('第三章習題（更正）')).toBeInTheDocument();

    // delete
    await user.click(screen.getByRole('button', { name: '刪除' }));
    const confirm = await screen.findByRole('dialog', { name: '刪除這個待辦？' });
    await user.click(within(confirm).getByRole('button', { name: '刪除' }));
    await waitFor(async () => expect(await repo.listTasks()).toHaveLength(0));
  });

  it('shows overdue tasks under 已逾期', async () => {
    const user = userEvent.setup();
    const repo = new LocalRepository(memoryStorage());
    await repo.upsertTask({ title: '遲交報告', kind: 'report', dueAt: new Date(Date.now() - 3 * 86400_000).toISOString(), priority: 'high', completed: false, remindMinutesBefore: null });
    renderApp(routes, '/tasks', repo);
    await user.click(await screen.findByRole('tab', { name: /已逾期/ }));
    expect(await screen.findByText('遲交報告')).toBeInTheDocument();
    expect(screen.getByText('已逾期 3 天')).toBeInTheDocument();
  });
});
