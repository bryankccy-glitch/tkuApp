import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt', user: { id: 'u1', email: 'a@b.c' } } } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth }, isCloudConfigured: true }));

import { AuthProvider } from '@/app/AuthProvider';
import { ImageImport, TimetableImportError } from '../ImageImport';
import type { ImportCell } from '@/lib/timetableImport';
import type { Course } from '@/lib/types';

const cell = (weekday: number, period: number, course: string, teacher: string, room: string): ImportCell => ({ weekday, period, group: '資管二', course, teacher, room });
const existing: Course[] = [{
  id: 'x', semesterId: 's', name: '經濟學', color: 'navy', createdAt: '', updatedAt: '',
  slots: [{ id: 'x1', weekday: 2, startTime: '08:10', endTime: '10:00', room: 'B607' }],
}];

function setup(recognize: (file: File) => Promise<ImportCell[]>) {
  const onImport = vi.fn(async () => {});
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <ImageImport open onClose={() => {}} existing={existing} importing={false} onUseCsv={() => {}} onImport={onImport} recognize={recognize} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { onImport };
}

const pick = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText('選擇課表圖片或拍照');
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await user.upload(input, new File(['x'], 'timetable.png', { type: 'image/png' }));
};

describe('ImageImport', () => {
  it('reads an image, lets the user review and edit, and imports only the chosen courses', async () => {
    const recognize = vi.fn(async (_file: File) => [
      cell(3, 3, '網路與通訊', '鄭培宇', 'B 217'),
      cell(3, 4, '網路與通訊', '鄭培宇', 'B 217'),
      cell(2, 1, '經濟學', '陳紹良', 'B 607'), // already in the timetable
      cell(2, 2, 'Python程式語言', '黃子嘉', 'B 130'), // clashes with 經濟學 (Tue 08:10–10:00)
    ]);
    const user = userEvent.setup();
    const { onImport } = setup(recognize);
    await pick(user);

    expect(recognize.mock.calls[0]![0]).toBeInstanceOf(File);
    expect(await screen.findByText('讀到 3 個課程項目（正課與助教課分開）')).toBeInTheDocument();
    expect(screen.getByText('課表裡已經有同名課程，預設不加入。')).toBeInTheDocument();
    expect(screen.getByText(/和「經濟學」時間衝突/)).toBeInTheDocument();
    expect(screen.getByText(/10:10–12:00/)).toBeInTheDocument(); // periods 3–4 merged
    // Rooms can be corrected before importing (OCR may misread a digit).
    const room = screen.getByDisplayValue('B217');
    await user.clear(room);
    await user.type(room, 'b218');

    const nameField = screen.getByDisplayValue('網路與通訊');
    await user.clear(nameField);
    await user.type(nameField, '網路與通訊實務');
    await user.click(screen.getByRole('button', { name: '加入 2 個課程項目' }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const list = (onImport.mock.calls[0] as unknown as [{ name: string; instructor?: string; slots: unknown[] }[]])[0];
    expect(list.map((c) => c.name)).toEqual(['Python程式語言', '網路與通訊實務']);
    expect(list[1]).toMatchObject({ instructor: '鄭培宇', slots: [{ weekday: 3, startTime: '10:10', endTime: '12:00', room: 'B218' }] });
  });

  it('explains when the on-device reader cannot load and offers CSV instead', async () => {
    const user = userEvent.setup();
    setup(async () => { throw new TimetableImportError('engine'); });
    await pick(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('辨識引擎載入失敗');
    expect(within(document.body).getByRole('button', { name: '改用 CSV 匯入' })).toBeInTheDocument();
  });

  it('says so when no timetable grid is found', async () => {
    const user = userEvent.setup();
    setup(async () => { throw new TimetableImportError('not_timetable'); });
    await pick(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('找不到課表表格');
  });

  it('works without an account, since nothing is uploaded', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as never);
    const recognize = vi.fn(async () => [cell(1, 1, '英文（二）', '李金安', 'SG 314')]);
    const user = userEvent.setup();
    setup(recognize);
    expect(await screen.findByText('圖片只在你的手機上辨識，不會上傳到任何伺服器。')).toBeInTheDocument();
    await pick(user);
    expect(await screen.findByDisplayValue('英文（二）')).toBeInTheDocument();
  });
});
