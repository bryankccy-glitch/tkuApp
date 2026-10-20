import { describe, expect, it, vi } from 'vitest';
import * as images from '@/lib/images';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarketPage, { filterPosts } from '../MarketPage';
import MarketPostPage from '../MarketPostPage';
import { renderApp } from '@/test/renderApp';
import { FakeSocial, repoWithSocial } from '@/test/fakeSocial';
import type { MarketPost } from '@/lib/social/types';

const routes = [
  { path: '/market', element: <MarketPage /> },
  { path: '/market/:id', element: <MarketPostPage /> },
];

const post = (over: Partial<MarketPost>): MarketPost => ({
  id: 'p1', userId: 'other', authorName: '學長', kind: 'sell', category: 'book', title: '微積分課本', description: '幾乎全新',
  price: 300, courseCode: 'TEBXB0A', condition: 'like_new', status: 'open', photos: [], commentCount: 0, createdAt: new Date().toISOString(), updatedAt: '', ...over,
});

describe('filterPosts', () => {
  const posts = [
    post({ id: 'a' }),
    post({ id: 'b', kind: 'want', title: '徵 資料結構', category: 'book' }),
    post({ id: 'c', userId: 'me', category: 'electronics', title: '計算機' }),
    post({ id: 'd', status: 'closed', title: '已賣掉的書' }),
  ];
  const base = { q: '', filter: 'all' as const, cat: 'all' as const, userId: 'me', showClosed: false };
  it('hides finished posts unless asked, but always shows your own under 我的', () => {
    expect(filterPosts(posts, base).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(filterPosts(posts, { ...base, showClosed: true }).map((p) => p.id)).toContain('d');
    expect(filterPosts([...posts, post({ id: 'e', userId: 'me', status: 'closed' })], { ...base, filter: 'mine' }).map((p) => p.id)).toEqual(['c', 'e']);
  });
  it('filters by kind, category and search text (incl. course code)', () => {
    expect(filterPosts(posts, { ...base, filter: 'want' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPosts(posts, { ...base, cat: 'electronics' }).map((p) => p.id)).toEqual(['c']);
    expect(filterPosts(posts, { ...base, q: 'tebxb0a' }).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Market pages', () => {
  it('asks guests to sign in', async () => {
    renderApp(routes, '/market');
    expect(await screen.findByText('登入後就能逛二手市集')).toBeInTheDocument();
  });

  it('requires agreeing to the trading tips, then publishes and opens the post', async () => {
    localStorage.removeItem('tku.market.rulesAccepted');
    const { repo, social } = repoWithSocial();
    const user = userEvent.setup();
    renderApp(routes, '/market', repo);
    await user.click((await screen.findAllByRole('button', { name: '發文' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: '新增貼文' });
    await user.type(within(dialog).getByLabelText('標題'), '普通物理 課本');
    await user.type(within(dialog).getByLabelText('售價（NT$）'), '25O0'); // letters are stripped
    expect(within(dialog).getByLabelText('售價（NT$）')).toHaveValue('250');
    await user.click(within(dialog).getByRole('button', { name: '刊登' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('請先勾選同意交易提醒');
    expect(social.posts).toHaveLength(0);

    await user.click(within(dialog).getByLabelText('我已閱讀並同意'));
    await user.click(within(dialog).getByRole('button', { name: '刊登' }));
    expect(await screen.findByRole('heading', { name: '普通物理 課本' })).toBeInTheDocument();
    expect(social.posts[0]).toMatchObject({ title: '普通物理 課本', price: 250, kind: 'sell' });
    expect(screen.getByText('管理我的貼文')).toBeInTheDocument();
  });

  it('uploads photos (downscaled) and shows them on the post', async () => {
    localStorage.setItem('tku.market.rulesAccepted', '1');
    vi.spyOn(images, 'downscaleToJpeg').mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { repo, social } = repoWithSocial();
    const user = userEvent.setup();
    renderApp(routes, '/market', repo);
    await user.click((await screen.findAllByRole('button', { name: '發文' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: '新增貼文' });
    await user.type(within(dialog).getByLabelText('標題'), '工程數學 講義');
    const file = new File(['img'], 'a.png', { type: 'image/png' });
    await user.upload(within(dialog).getByLabelText('加入照片'), file);
    expect(await within(dialog).findByRole('button', { name: '移除這張照片' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '刊登' }));
    expect(await screen.findByRole('img', { name: '商品照片 1' })).toBeInTheDocument();
    expect(social.posts[0]!.photos).toHaveLength(1);
    expect(images.downscaleToJpeg).toHaveBeenCalledTimes(1);
  });

  it('lets others comment and report, but not manage the post', async () => {
    const social = new FakeSocial();
    social.posts.push(post({}));
    const { repo } = repoWithSocial(social);
    const user = userEvent.setup();
    renderApp(routes, '/market/p1', repo);
    expect(await screen.findByRole('heading', { name: '微積分課本' })).toBeInTheDocument();
    expect(screen.getByText('NT$ 300')).toBeInTheDocument();
    expect(screen.queryByText('管理我的貼文')).toBeNull();

    await user.type(screen.getByLabelText('留言內容'), '我想要，週三可以嗎？');
    await user.click(screen.getByRole('button', { name: '送出留言' }));
    expect(await screen.findByText('我想要，週三可以嗎？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '檢舉這篇貼文' }));
    const dialog = await screen.findByRole('dialog', { name: '檢舉貼文' });
    await user.click(within(dialog).getByLabelText('疑似詐騙'));
    await user.click(within(dialog).getByRole('button', { name: '送出檢舉' }));
    expect(await screen.findByText('已收到檢舉，謝謝你')).toBeInTheDocument();
    expect(social.reports).toEqual([{ postId: 'p1', reason: 'scam', note: '' }]);
  });

  it('owner can mark a post reserved and closed; closed posts stop taking comments', async () => {
    const social = new FakeSocial();
    social.posts.push(post({ userId: 'me', authorName: '我' }));
    const { repo } = repoWithSocial(social);
    const user = userEvent.setup();
    renderApp(routes, '/market/p1', repo);
    await user.click(await screen.findByRole('tab', { name: '已保留' }));
    expect(await screen.findByText('已更新狀態')).toBeInTheDocument();
    expect(social.posts[0]!.status).toBe('reserved');
    await user.click(screen.getByRole('tab', { name: '已完成' }));
    expect(await screen.findByText('這篇貼文已完成，不再開放留言。')).toBeInTheDocument();
    expect(screen.queryByLabelText('留言內容')).toBeNull();
    expect(screen.queryByRole('button', { name: '檢舉這篇貼文' })).toBeNull();
  });
});
