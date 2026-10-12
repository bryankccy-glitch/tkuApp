import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCampusWeather, isStale, readCachedWeather, REFRESH_MS, WeatherError, type CampusWeather, type WeatherErrorKind } from '@/services/weatherService';

export interface CampusWeatherState {
  /** Latest valid weather (fresh fetch or last cached). null = never fetched successfully. */
  weather: CampusWeather | null;
  loading: boolean;
  /** Data is older than the stale threshold, or the latest refresh failed and we show cached data. */
  stale: boolean;
  error: WeatherErrorKind | null;
  online: boolean;
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Tamsui weather, refreshed every 20 minutes; falls back to the last valid cached reading. */
export function useCampusWeather(): CampusWeatherState {
  const online = useOnline();
  const q = useQuery({
    queryKey: ['campus-weather'],
    queryFn: () => fetchCampusWeather(),
    staleTime: REFRESH_MS - 60_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 5_000,
    enabled: online,
  });
  const cached = q.data ?? readCachedWeather();
  const error = !online ? 'offline' : q.error instanceof WeatherError ? q.error.kind : q.error ? 'http' : null;
  return {
    weather: cached,
    loading: q.isLoading && !cached,
    stale: cached ? isStale(cached) || (!!error && !q.data) : false,
    error,
    online,
  };
}
