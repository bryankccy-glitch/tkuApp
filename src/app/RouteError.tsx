import { useRouteError } from 'react-router-dom';
import { LogoMark } from '@/components/brand/Logo';
import { t } from '@/i18n/t';

const RELOAD_KEY = 'tku.chunkReload';

/** A page's code from an older version is gone after a deploy (the app was open or cached). */
export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|module script|MIME type|ChunkLoadError|Loading chunk/i.test(msg);
}

/** Reload once to pick up the new version; a second failure in the same session shows the error screen. */
export function reloadForNewVersion(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Router error screen: replaces React Router's developer page ("Unexpected Application Error"). */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleChunkError(error);
  if (stale && reloadForNewVersion()) return null;
  return (
    <div className="app-frame mx-auto flex min-h-dvh w-full max-w-app flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <LogoMark className="h-14 w-14" />
      <div>
        <h1 className="text-h2 text-ink">{stale ? t('common.updatedTitle') : t('common.errorTitle')}</h1>
        <p className="mt-1 text-body text-muted">{stale ? t('common.updatedBody') : t('common.errorBody')}</p>
      </div>
      <button
        type="button"
        onClick={() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } window.location.reload(); }}
        className="inline-flex h-11 items-center rounded-sm bg-primary px-5 font-semibold text-white dark:text-[#1A0506]"
      >
        {t('common.reload')}
      </button>
    </div>
  );
}
