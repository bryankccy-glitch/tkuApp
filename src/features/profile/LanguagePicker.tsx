import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { setLanguage } from '@/i18n';
import { LANGUAGES, isBuiltIn } from '@/i18n/languages';
import { cn } from '@/lib/cn';

/** 繁中／简中／English as buttons, every other language from a list (machine translation). */
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const current = i18n.language;
  const builtIn = LANGUAGES.filter((l) => l.builtIn);
  const more = LANGUAGES.filter((l) => !l.builtIn);

  const choose = async (code: string) => {
    if (code === current) return;
    setLoading(code);
    try {
      await setLanguage(code);
    } catch {
      toast({ tone: 'error', message: t('settings.languageFailed') });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <h3 id="p-lang" className="mt-5 text-body font-semibold text-ink">{t('settings.language')}</h3>
      <div role="radiogroup" aria-labelledby="p-lang" className="mt-2 grid grid-cols-3 gap-2">
        {builtIn.map((l) => (
          <button key={l.code} type="button" role="radio" lang={l.code} aria-checked={current === l.code} onClick={() => void choose(l.code)}
            className={cn('h-11 rounded-sm border text-caption font-semibold', current === l.code ? 'border-primary bg-primary/[0.06] text-primary' : 'border-line text-muted hover:text-ink')}>
            {l.name}
          </button>
        ))}
      </div>
      <label htmlFor="p-lang-more" className="mt-3 flex items-center gap-1.5 text-caption font-semibold text-ink">
        <Languages className="h-4 w-4 text-muted" aria-hidden />{t('settings.moreLanguages')}
      </label>
      <select id="p-lang-more" className="field mt-1.5" disabled={loading !== null}
        value={isBuiltIn(current) ? '' : current} onChange={(e) => e.target.value && void choose(e.target.value)}>
        <option value="">{loading ? t('settings.languageLoading') : t('settings.chooseLanguage')}</option>
        {more.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.name} · {l.english}</option>)}
      </select>
      <p className="mt-1.5 text-[11px] text-muted">{!isBuiltIn(current) ? t('settings.machineNote') : t('settings.moreNote')}</p>
    </>
  );
}
