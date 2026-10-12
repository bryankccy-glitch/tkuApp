import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulePage from '../SchedulePage';
import CourseDetailPage from '../CourseDetailPage';
import { renderApp } from '@/test/renderApp';
import { LocalRepository } from '@/lib/data/local';
import { memoryStorage } from '@/test/memoryStorage';

const routes = [
  { path: '/schedule', element: <SchedulePage /> },
  { path: '/schedule/course/:id', element: <CourseDetailPage /> },
];

async function seededRepo() {
  const repo = new LocalRepository(memoryStorage());
  const [sem] = await repo.listSemesters();
  const course = await repo.upsertCourse({
    semesterId: sem!.id, name: '資料結構', instructor: '王老師', color: 'blue',
    slots: [{ weekday: 1, startTime: '10:10', endTime: '12:00', room: 'E304' }],
  });
  return { repo, course };
}

describe('SchedulePage', () => {
  it('adds a course through the form and stores it', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp(routes, '/schedule');
    await user.click(await screen.findByRole('button', { name: '新增第一門課' }));
    const dialog = await screen.findByRole('dialog', { name: '新增課程' });
    await user.type(within(dialog).getByLabelText('課程名稱'), '微積分');
    await user.type(within(dialog).getByLabelText('授課教師'), '陳老師');
    await user.type(within(dialog).getByLabelText('教室'), 's101');
    await user.click(screen.getByRole('button', { name: '加入課表' }));

    await waitFor(async () => {
      const [sem] = await repo.listSemesters();
      const courses = await repo.listCourses(sem!.id);
      expect(courses).toHaveLength(1);
      expect(courses[0]!.name).toBe('微積分');
      expect(courses[0]!.slots[0]!.room).toBe('S101');
    });
    expect(await screen.findByText('已加入「微積分」')).toBeInTheDocument();
  });

  it('blocks saving without a course name', async () => {
    const user = userEvent.setup();
    const { repo } = renderApp(routes, '/schedule?add=1');
    await screen.findByRole('dialog', { name: '新增課程' });
    await user.click(screen.getByRole('button', { name: '加入課表' }));
    expect(await screen.findByText('請輸入課程名稱')).toBeInTheDocument();
    const [sem] = await repo.listSemesters();
    expect(await repo.listCourses(sem!.id)).toHaveLength(0);
  });

  it('warns about a time conflict while filling the form', async () => {
    const user = userEvent.setup();
    const { repo } = await seededRepo();
    renderApp(routes, '/schedule?add=1', repo);
    const dialog = await screen.findByRole('dialog', { name: '新增課程' });
    // default slot is Monday 08:10–10:00; move end to 11:00 to overlap 10:10–12:00
    const end = within(dialog).getByLabelText('結束');
    await user.clear(end);
    await user.type(end, '11:00');
    expect(await within(dialog).findByText('時間與其他課程重疊')).toBeInTheDocument();
    expect(within(dialog).getByText(/資料結構（週一 10:10–12:00）/)).toBeInTheDocument();
  });

  it('applies TKU periods to start and end times', async () => {
    const user = userEvent.setup();
    renderApp(routes, '/schedule?add=1');
    const dialog = await screen.findByRole('dialog', { name: '新增課程' });
    await user.selectOptions(within(dialog).getByLabelText('以節次設定：第'), '3');
    await user.selectOptions(within(dialog).getByLabelText('到'), '4');
    expect(within(dialog).getByLabelText('開始')).toHaveValue('10:10');
    expect(within(dialog).getByLabelText('結束')).toHaveValue('12:00');
  });

  it('edits and deletes a course from its detail page', async () => {
    const user = userEvent.setup();
    const { repo, course } = await seededRepo();
    renderApp(routes, `/schedule/course/${course.id}`, repo);
    expect(await screen.findByRole('heading', { name: '資料結構' })).toBeInTheDocument();
    expect(screen.getByText('（工學大樓）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '編輯' }));
    const dialog = await screen.findByRole('dialog', { name: '編輯課程' });
    const name = within(dialog).getByLabelText('課程名稱');
    await user.clear(name);
    await user.type(name, '資料結構與演算法');
    await user.click(screen.getByRole('button', { name: '儲存變更' }));
    expect(await screen.findByRole('heading', { name: '資料結構與演算法' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '刪除' }));
    await user.click(await screen.findByRole('button', { name: '刪除課程' }));
    await waitFor(async () => expect(await repo.listCourses(course.semesterId)).toHaveLength(0));
  });
});
