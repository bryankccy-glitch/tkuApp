import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthProvider';
import { ThemeProvider } from '@/app/ThemeProvider';
import { SemesterProvider } from '@/app/SemesterProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { LocalRepository } from '@/lib/data/local';
import { memoryStorage } from './memoryStorage';

/**
 * Renders routes inside every app provider with an isolated 本機模式 repository.
 * Returns the repo so tests can seed and assert stored data.
 */
export function renderApp(routes: { path: string; element: ReactElement }[], initialPath: string, repo = new LocalRepository(memoryStorage())) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <AuthProvider localRepository={repo}>
          <ToastProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <SemesterProvider>
                <Routes>
                  {routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
                  <Route path="*" element={<p>other page</p>} />
                </Routes>
              </SemesterProvider>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...utils, repo };
}
