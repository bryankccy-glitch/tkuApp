import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/AuthProvider';
import { ThemeProvider } from './app/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';
import { BootScreen } from './components/brand/Logo';
import { router } from './app/router';
import { LanguageRoot } from './app/LanguageRoot';
import './styles/index.css';
import { i18nReady } from './i18n';
import { seedPreviewDemo } from './lib/data/previewDemo';
import { disablePageZoom } from './lib/noZoom';
import { holdSplash } from './lib/splash';
import { installIosShortViewport } from './lib/iosShortViewport';
import { installPwaUpdates } from './lib/pwaUpdate';
import { reloadForNewVersion } from './app/RouteError';

disablePageZoom();
installIosShortViewport();
installPwaUpdates();

// After a deploy, an open/cached app may ask for page code that no longer exists: reload once to get the new version.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});
// Loaded fine this time: allow one automatic reload again for the next deploy.
window.addEventListener('load', () => setTimeout(() => { try { sessionStorage.removeItem('tku.chunkReload'); } catch { /* ignore */ } }, 10_000));

if (import.meta.env.VITE_PREVIEW_DEMO === '1') {
  seedPreviewDemo();
  // Hosted previews always open on the sign-in screen, even after choosing guest last time.
  try { localStorage.removeItem('tku.guest'); } catch { /* storage unavailable */ }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

// Hold the splash through the first render; BootScreens rendered during it take their own holds.
const releaseInitialSplash = holdSplash();
function SplashRelease() {
  useEffect(releaseInitialSplash, []);
  return null;
}

void i18nReady.then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <LanguageRoot>
              <Suspense fallback={<BootScreen />}>
                <RouterProvider router={router} />
                <SplashRelease />
              </Suspense>
            </LanguageRoot>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
));
