import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import '@/i18n';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* ignore */ }
});

// jsdom gaps
window.scrollTo = function () {};
HTMLCanvasElement.prototype.getContext = function () { return null; };
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function () {};
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}

// No network in unit tests: weather requests fail fast and the UI shows its fallback.
vi.stubGlobal('fetch', () => Promise.reject(new Error('network disabled in tests')));
