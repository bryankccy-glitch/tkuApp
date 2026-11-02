import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as images from '@/lib/images';
import { renderApp } from '@/test/renderApp';
import { repoWithSocial } from '@/test/fakeSocial';
import { t } from '@/i18n/t';
import { PostForm } from '../PostForm';
import type { MarketPost } from '@/lib/social/types';

const savedPost: MarketPost = {
  id: 'saved', userId: 'me', authorName: 'me', kind: 'sell', category: 'book',
  title: 'Saved book', description: '', price: null, courseCode: null,
  condition: null, status: 'open', photos: ['saved-photo'], commentCount: 0,
  createdAt: '', updatedAt: '',
};

function setup(onSubmit = vi.fn().mockResolvedValue(false), initial?: MarketPost, rulesAccepted = true) {
  localStorage.setItem('tku.market.rulesAccepted', '1');
  vi.spyOn(images, 'downscaleToJpeg').mockResolvedValue(new Blob(['jpeg']));
  const { repo, social } = repoWithSocial();
  social.rulesAccepted = rulesAccepted;
  const onClose = vi.fn();
  const view = renderApp([{
    path: '/', element: <PostForm open onClose={onClose} onSubmit={onSubmit} initial={initial} />,
  }], '/', repo);
  const input = () => waitFor(() => {
    const el = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(el).toBeEnabled();
    return el!;
  });
  return { ...view, social, onClose, onSubmit, input, user: userEvent.setup() };
}

describe('PostForm photo lifecycle', () => {
  it('preserves fresh and removed tracking on failed save, then deletes removed photos after success', async () => {
    const submit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { social, input, user, unmount } = setup(submit, savedPost);
    await user.click(await screen.findByRole('button', { name: '移除這張照片' }));
    await user.upload(await input(), new File(['x'], 'x.png', { type: 'image/png' }));
    await screen.findByRole('button', { name: '移除這張照片' });
    await user.click(screen.getByRole('button', { name: '儲存變更' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(social.removedPhotos).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '儲存變更' }));
    await waitFor(() => expect(social.removedPhotos).toEqual(['saved-photo']));
    unmount();
    expect(social.removedPhotos).toEqual(['saved-photo']);
  });

  it('keeps uploads when a successful save unmounts the form before resolving', async () => {
    const unmountFirst = { run: () => {} };
    const submit = vi.fn(async () => { unmountFirst.run(); return true; });
    const { social, input, user, unmount } = setup(submit);
    unmountFirst.run = unmount;
    await user.upload(await input(), new File(['a'], 'a.png', { type: 'image/png' }));
    await screen.findByRole('button', { name: '移除這張照片' });
    fireEvent.change(screen.getByLabelText('標題'), { target: { value: 'New book' } });
    fireEvent.submit(screen.getByLabelText('標題').closest('form')!);
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(social.removedPhotos).toEqual([]);
  });

  it('keeps a failed save upload tracked for cancellation', async () => {
    const { social, input, user, onSubmit } = setup(undefined, savedPost);
    vi.spyOn(social, 'uploadMarketPhoto').mockResolvedValueOnce('unsaved-photo');
    await user.upload(await input(), new File(['a'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: '移除這張照片' })).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: '儲存變更' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(social.removedPhotos).toEqual(['unsaved-photo']);
  });

  it('tracks an earlier successful upload when the next file fails and cleans it on unmount', async () => {
    const { social, input, user, unmount } = setup();
    vi.spyOn(social, 'uploadMarketPhoto').mockResolvedValueOnce('fresh-photo').mockRejectedValueOnce(new Error('offline'));
    await user.upload(await input(), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除這張照片' })).toBeInTheDocument();
    unmount();
    expect(social.removedPhotos).toEqual(['fresh-photo']);
  });

  it.each(['cancel', 'unmount'] as const)('removes a late upload after %s without adding it to the form', async (end) => {
    const { social, input, user, unmount } = setup();
    let finish!: (url: string) => void;
    const upload = vi.spyOn(social, 'uploadMarketPhoto').mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    await user.upload(await input(), new File(['a'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    if (end === 'cancel') await user.click(screen.getByRole('button', { name: '取消' }));
    else unmount();
    await act(async () => { finish('late-photo'); });
    expect(social.removedPhotos).toEqual(['late-photo']);
    expect(screen.queryByRole('button', { name: '移除這張照片' })).toBeNull();
  });

  it('stops submission and displays an error if rules acceptance fails', async () => {
    const { social, onSubmit } = setup(undefined, undefined, false);
    const accept = vi.spyOn(social, 'acceptRules').mockRejectedValue(new Error('offline'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('標題'), { target: { value: 'New book' } });
    const checkbox = within(dialog).getByRole('checkbox');
    await waitFor(() => expect(checkbox).not.toBeDisabled());
    fireEvent.click(checkbox);
    fireEvent.submit(within(dialog).getByLabelText('標題').closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('widget.failed'));
    expect(accept).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
