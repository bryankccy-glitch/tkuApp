import { useEffect, useState } from 'react';

type Resolved = 'light' | 'dark';
const read = (): Resolved => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/**
 * The theme actually shown ('system' already resolved), following live changes.
 * ThemeProvider writes it to <html data-theme>, so watch that attribute.
 */
export function useResolvedTheme(): Resolved {
  const [theme, setTheme] = useState<Resolved>(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
