import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from '@/features/schedule/SchedulePage';
import { renderApp } from '@/test/renderApp';
import { FakeSocial, repoWithSocial } from '@/test/fakeSocial';
import { inferSemester } from '@/lib/data/semesters';

const routes = [{ path: '/schedule', element: <SchedulePage /> }];

describe('Friends timetable', () => {
  it('asks guests to sign in instead of showing friends', async () => {
    renderApp(routes, '/schedule?tab=friends');
    expect(await screen.findByText('登入後就能和朋友互看課表')).toBeInTheDocument();
  });

  it('shows my code and sends a request by code (from an invite link)', async () => {
    const social = new FakeSocial();
    social.codes.set('ABCD2345', { id: 'u2', name: '小明' });
    const { repo } = repoWithSocial(social);
    const user = userEvent.setup();
    renderApp(routes, '/schedule?tab=friends&code=abcd2345', repo);
    expect(await screen.findByText('MYCODE23')).toBeInTheDocument();
    const input = screen.getByLabelText('朋友的好友代碼');
    expect(input).toHaveValue('abcd2345');
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByText('已送出邀請，等對方接受')).toBeInTheDocument();
    expect(await screen.findByText('已送出的邀請')).toBeInTheDocument();
    expect(screen.getByText('小明')).toBeInTheDocument();
  });

  it('rejects malformed codes without calling the server', async () => {
    const { repo, social } = repoWithSocial();
    const user = userEvent.setup();
    renderApp(routes, '/schedule?tab=friends', repo);
    await user.type(await screen.findByLabelText('朋友的好友代碼'), 'abc');
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByText('好友代碼是 8 個英文字母或數字')).toBeInTheDocument();
    expect(social.friends).toHaveLength(0);
  });

  it('accepts a request, then shows the friend’s timetable and common free periods', async () => {
    const social = new FakeSocial();
    social.friends.push({ friendshipId: 'f1', friendId: 'u2', displayName: '小美', department: '資工系', direction: 'incoming', createdAt: '' });
    social.schedules.set('u2', [{
      id: 'c1', semesterId: '', name: '資料結構', color: 'blue', createdAt: '', updatedAt: '',
      slots: [{ id: 's1', weekday: 1, startTime: '08:10', endTime: '12:00', room: 'E304' }],
    }]);
    const { repo } = repoWithSocial(social);
    await repo.upsertSemester(inferSemester(new Date()));
    const user = userEvent.setup();
    renderApp(routes, '/schedule?tab=friends', repo);

    expect(await screen.findByRole('tab', { name: /好友\s*1/ })).toBeInTheDocument(); // pending badge on the tab
    await user.click(await screen.findByRole('button', { name: '接受 小美 的邀請' }));
    expect(await screen.findByText('已和 小美 成為好友')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /小美/ }));
    expect(await screen.findByRole('heading', { name: '小美 的課表' })).toBeInTheDocument();
    const block = await screen.findByRole('group', { name: /資料結構/ });
    expect(block.tagName).toBe('DIV'); // read-only: not a link into their course

    await user.click(screen.getByRole('tab', { name: /共同空堂/ }));
    const monday = (await screen.findByText('週一')).closest('li')!;
    expect(within(monday).getByText(/12:10–20:00/)).toBeInTheDocument(); // Mon morning is busy for her
    expect(within(monday).queryByText(/08:10/)).toBeNull();
  });
});
