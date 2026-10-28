import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n';
import { CalendarClock, CalendarDays, ListChecks, MapPinned, Megaphone, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { PixelCampusScene } from '@/components/campus-scene/PixelCampusScene';
import { buildScene, greetingKey } from '@/components/campus-scene/SceneController';
import type { DayPhase, SceneState, SceneWeather } from '@/components/campus-scene/sceneTypes';
import { useCampusWeather } from '@/hooks/useCampusWeather';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';
import { WEATHER_SOURCE } from '@/services/weatherService';
import type { Cheer } from '@/lib/encouragement';

export interface HeroSummary {
  total: number;
  remaining: number;
  dueToday: number;
}

const PHASES: DayPhase[] = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];

/** `?scene=night,rainy` (or sunset / cloudy / …) previews a scene without changing real data. */
function applyOverride(scene: SceneState, raw: string | null): SceneState {
  if (!raw) return scene;
  const parts = raw.split(',');
  let next = { ...scene };
  for (const part of parts) {
    if (part === 'sunset') next = { ...next, phase: 'dusk', sunProgress: 0.97, lights: 0.4 };
    else if (part === 'night') next = { ...next, phase: 'night', sunProgress: 1.3, lights: 1 };
    else if ((PHASES as string[]).includes(part)) next = { ...next, phase: part as DayPhase, sunProgress: { dawn: 0.03, morning: 0.25, noon: 0.5, afternoon: 0.72, dusk: 0.97, night: 1.3 }[part as DayPhase], lights: part === 'night' ? 1 : 0 };
    else if (['sunny', 'cloudy', 'rainy'].includes(part)) {
      const weather = part as SceneWeather;
      next = { ...next, weather, rainIntensity: weather === 'rainy' ? 0.7 : 0, cloudCover: weather === 'sunny' ? 0.25 : weather === 'cloudy' ? 0.75 : 0.95 };
    } else if (part === 'fog') next = { ...next, fog: true, weather: 'cloudy', cloudCover: 0.8 };
  }
  const kind = next.phase === 'night' ? 'night' : next.phase === 'dusk' && next.weather !== 'rainy' ? 'sunset' : next.weather;
  return { ...next, kind };
}

/** `name` / `summary` are undefined while the user's data is still loading: the scene and weather show right away. */
export function Hero({ name, summary, cheer }: { name?: string; summary?: HeroSummary; cheer?: Cheer | null }) {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const { weather, loading, stale, error, online } = useCampusWeather();
  const tod = useTimeOfDay(weather);
  const scene = useMemo(() => applyOverride(buildScene(tod.now, tod.sunrise, tod.sunset, weather), params.get('scene')), [tod, weather, params]);
  const g = greetingKey(tod.phase, tod.now, tod.sunset);
  const locale = intlLocale(i18n.language);
  const date = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Taipei' }).format(tod.now);
  const timeFmt = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }).format(new Date(iso));

  const summaryText = summary && [
    summary.total === 0
      ? t('hero.summary.none')
      : summary.remaining === 0
        ? t('hero.summary.allDone', { count: summary.total })
        : t('hero.summary.remaining', { count: summary.total, left: summary.remaining }),
    summary.dueToday ? t('hero.summary.dueToday', { count: summary.dueToday }) : '',
  ].filter(Boolean).join(' ');

  return (
    <section aria-labelledby="hero-greeting" className="relative h-[400px] overflow-hidden rounded-b-[28px] bg-[#171717] text-white">
      <PixelCampusScene scene={scene} label={t('hero.sceneLabel', { scene: t(`weather.scene.${scene.kind}`) })} />
      {/* Local translucent mask behind the text so moving clouds never reduce contrast. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-[linear-gradient(180deg,rgb(10_10_14/0.55)_0%,rgb(10_10_14/0.32)_55%,rgb(10_10_14/0)_100%)]" />
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-[62%] w-[70%] bg-[radial-gradient(ellipse_at_0%_35%,rgb(10_10_14/0.28),rgb(10_10_14/0)_70%)]" />

      <div className="relative z-10 flex items-start justify-between gap-3 px-4 pt-[calc(0.875rem+env(safe-area-inset-top))] [text-shadow:0_1px_2px_rgb(0_0_0/0.55)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7 rounded-[8px]" />
            <span className="text-[13px] font-bold tracking-tight">TKU Campus OS</span>
          </div>
          <p className="mt-4 text-caption text-white/85">{date}</p>
          <h1 id="hero-greeting" className="mt-1 text-[1.625rem] font-bold leading-tight tracking-tight">
            {name ? t('greeting.withName', { greeting: t(`greeting.${g}.title`), name }) : t(`greeting.${g}.title`)}
          </h1>
          <p className="mt-1 text-body text-white/90">{cheer ? t(`greeting.cheer.${cheer.key}`, cheer.vars) : t(`greeting.${g}.line`)}</p>
          {summaryText !== undefined ? (
            <p className="mt-2 text-caption text-white/80">{summaryText}</p>
          ) : (
            <span aria-hidden className="mt-3 block h-3 w-40 rounded-full bg-white/20 motion-safe:animate-pulse" />
          )}
        </div>

        <div className="w-[7.5rem] shrink-0 text-right" aria-live="polite">
          <p className="text-caption font-semibold text-white/85">{t('weather.place')}</p>
          {weather ? (
            <>
              <p className="tabular text-[2.25rem] font-bold leading-none tracking-tight">{Math.round(weather.temperature)}°</p>
              <p className="mt-1 text-caption font-semibold">{t(`weather.condition.${weather.condition}`)}</p>
              <p className="tabular mt-0.5 text-[11px] text-white/80">{t('weather.feelsLike', { value: Math.round(weather.apparentTemperature) })}</p>
              {(stale || error) && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/95">
                  {!online && <WifiOff className="h-3 w-3" aria-hidden />}
                  {!online ? t('weather.offline') : t('weather.stale', { time: timeFmt(weather.fetchedAt) })}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-caption text-white/85">
              {loading ? t('weather.loading') : !online ? t('weather.offline') : t('weather.unavailable')}
            </p>
          )}
        </div>
      </div>

      <a
        href={WEATHER_SOURCE.url}
        target="_blank"
        rel="noreferrer noopener"
        className="absolute bottom-9 right-3 z-10 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/85 hover:text-white"
      >
        {t('weather.source')}
      </a>
    </section>
  );
}

export function QuickActions() {
  const { t } = useTranslation();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const item = 'flex flex-col items-center gap-1.5 rounded-sm py-2 text-[11px] font-semibold text-ink transition-colors hover:bg-sunken';
  const icon = 'flex h-10 w-10 items-center justify-center rounded-full bg-primary/[0.08] text-primary';
  return (
    <nav aria-label={t('quick.label')} className="relative z-10 mx-4 -mt-7 grid grid-cols-5 gap-1 rounded-lg border border-line bg-surface p-2 shadow-lift">
      <button type="button" className={item} onClick={() => scrollTo('next-class-anchor')}>
        <span className={icon}><CalendarClock className="h-5 w-5" /></span>{t('quick.nextClass')}
      </button>
      <button type="button" className={item} onClick={() => scrollTo('today-title')}>
        <span className={icon}><CalendarDays className="h-5 w-5" /></span>{t('quick.today')}
      </button>
      <Link to="/explore" className={item}>
        <span className={icon}><MapPinned className="h-5 w-5" /></span>{t('quick.findRoom')}
      </Link>
      <Link to="/events" className={item}>
        <span className={icon}><Megaphone className="h-5 w-5" /></span>{t('quick.events')}
      </Link>
      <Link to="/tasks" className={item}>
        <span className={icon}><ListChecks className="h-5 w-5" /></span>{t('quick.tasks')}
      </Link>
    </nav>
  );
}
