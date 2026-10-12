import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssistantPage from '../AssistantPage';
import { renderApp } from '@/test/renderApp';
import * as engine from '../localEngine';

const routes = [{ path: '/assistant', element: <AssistantPage /> }];

describe('AssistantPage', () => {
  it('answers a quick question with an official source card', async () => {
    const user = userEvent.setup();
    renderApp(routes, '/assistant');
    await user.click(await screen.findByRole('button', { name: '淡江病假怎麼請？' }));
    const link = await screen.findByRole('link', { name: /淡江大學學生請假規則/ }, { timeout: 4000 });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\/sa\.tku\.edu\.tw\//));
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(screen.getByText('資料來源')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '複製回答' })).toBeInTheDocument();
  });

  it('runs a question passed from the home screen (?q=) and keeps history until cleared', async () => {
    const user = userEvent.setup();
    renderApp(routes, `/assistant?q=${encodeURIComponent('第 5 節是幾點？')}`);
    await waitFor(() => expect(screen.getByRole('button', { name: '複製回答' })).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByText('12:10–13:00', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清除對話' }));
    const dialog = await screen.findByRole('dialog', { name: '清除對話紀錄？' });
    await user.click(within(dialog).getByRole('button', { name: '清除' }));
    expect(await screen.findByText('想知道什麼？')).toBeInTheDocument();
  });

  it('shows an error with retry, and retry recovers', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(engine, 'answerLocally').mockImplementationOnce(() => {
      throw new Error('助理暫時無法回應（測試）');
    });
    renderApp(routes, '/assistant');
    const input = await screen.findByLabelText('輸入問題');
    await user.type(input, '第 1 節是幾點？{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('助理暫時無法回應（測試）');
    await user.click(within(alert).getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '複製回答' })).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByText('08:10–09:00', { exact: false })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not render raw HTML from answers (XSS)', async () => {
    const user = userEvent.setup();
    vi.spyOn(engine, 'answerLocally').mockReturnValueOnce({ content: '<img src=x onerror="alert(1)">**粗體**', sources: [] });
    const { container } = renderApp(routes, '/assistant');
    await user.type(await screen.findByLabelText('輸入問題'), 'test{Enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: '複製回答' })).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByText('粗體').tagName).toBe('STRONG');
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
});
