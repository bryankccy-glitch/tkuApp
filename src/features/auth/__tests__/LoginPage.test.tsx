import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// A configured-but-fake Supabase client: the login page only exists when cloud sign-in is available.
const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth }, isCloudConfigured: true }));

import { AuthProvider, useAuth } from '@/app/AuthProvider';
import LoginPage from '../LoginPage';

function Home() {
  const { mode, isGuest } = useAuth();
  return <p>home {mode} {isGuest ? 'guest' : ''}</p>;
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('validates input before calling Supabase', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: '登入' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請輸入有效的 Email');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('maps bad credentials to a friendly message', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    renderLogin();
    await user.type(await screen.findByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('密碼'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '登入' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email 或密碼不正確');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'student@example.com', password: 'wrong-password' });
  });

  it('sends the nickname as display_name on sign-up and asks to verify email', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const user = userEvent.setup();
    renderLogin();
    await user.click(await screen.findByRole('tab', { name: '註冊' }));
    await user.type(screen.getByLabelText(/暱稱/), '小淡');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('密碼'), 'a-long-password');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));
    expect(await screen.findByRole('status')).toHaveTextContent('已寄出驗證信');
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      options: expect.objectContaining({ data: { display_name: '小淡' } }),
    }));
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLogin();
    const pw = await screen.findByLabelText('密碼');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '顯示密碼' }));
    expect(pw).toHaveAttribute('type', 'text');
  });

  it('continues as a guest with on-device data and remembers the choice', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(await screen.findByRole('button', { name: '先不登入，直接使用' }));
    expect(await screen.findByText(/home local guest/)).toBeInTheDocument();
    expect(localStorage.getItem('tku.guest')).toBe('1');
  });
});
