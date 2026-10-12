import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/AuthProvider';
import { ThemeProvider } from './app/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';
import { LoadingMark } from './components/brand/Logo';
import { router } from './app/router';
import { LanguageRoot } from './app/LanguageRoot';
import './styles/index.css';
import './i18n';
import { seedPreviewDemo } from './lib/data/previewDemo';

if (import.meta.env.VITE_PREVIEW_DEMO === '1') {
  seedPreviewDemo();
  // Hosted previews always open on the sign-in screen, even after choosing guest last time.
  try { localStorage.removeItem('tku.guest'); } catch { /* storage unavailable */ }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <LanguageRoot>
              <Suspense fallback={<LoadingMark />}>
                <RouterProvider router={router} />
              </Suspense>
            </LanguageRoot>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
