import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Re-mounts the UI when the language changes so every label (including ones read from
 * translated maps outside React) refreshes. Data stays in the query cache, so nothing is refetched.
 */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  return <div key={i18n.language} className="contents">{children}</div>;
}
