import { useMemo } from 'react';
import { useNow } from '@/lib/hooks';
import { sunTimes } from '@/lib/solar';
import { CAMPUS_CENTER } from '@/data/places';
import { sameTaipeiDay } from '@/lib/taipei';
import { phaseAt, type DayPhase } from '@/components/campus-scene/SceneController';

export interface TimeOfDay {
  now: Date;
  phase: DayPhase;
  sunrise: Date;
  sunset: Date;
  /** true when sunrise/sunset came from the weather API rather than the local solar calculation */
  fromApi: boolean;
}

/** Time of day in Tamsui, using API sunrise/sunset when available, otherwise a local solar calculation. */
export function useTimeOfDay(api?: { sunrise: string; sunset: string } | null): TimeOfDay {
  const now = useNow(60_000);
  return useMemo(() => {
    const apiDay = api ? new Date(api.sunrise) : null;
    const sameDay = apiDay && sameTaipeiDay(apiDay, now);
    const { sunrise, sunset } = sameDay && api ? { sunrise: new Date(api.sunrise), sunset: new Date(api.sunset) } : sunTimes(now, CAMPUS_CENTER.lat, CAMPUS_CENTER.lng);
    return { now, sunrise, sunset, phase: phaseAt(now, sunrise, sunset), fromApi: Boolean(sameDay) };
  }, [now, api]);
}
