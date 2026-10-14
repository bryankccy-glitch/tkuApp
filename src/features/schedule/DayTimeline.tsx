import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Occurrence } from '@/lib/schedule';
import { statusAt } from '@/lib/schedule';
import { COURSE_COLOR_STYLES } from '@/lib/labels';
import { formatPeriods, timesToPeriods } from '@/lib/periods';
import { roomWithBuilding } from '@/data/places';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';
import { courseTitle } from '@/lib/courseTitle';

function Row({ to, children, className }: { to?: string; children: ReactNode; className?: string }) {
  if (to) return <Link to={to} className={className}>{children}</Link>;
  return <div className={className}>{children}</div>;
}

const STATUS_LABEL = { done: 'class.done', ongoing: 'class.ongoing', upcoming: 'class.upcoming' } as const;

/** Vertical timeline for one day. `now` is only used when the list is for today. */
export function DayTimeline({ items, now, readOnly }: { items: Occurrence[]; now?: Date; /** A friend's timetable: rows are not links. */ readOnly?: boolean }) {
  return (
    <ol className="relative">
      {items.map(({ course, slot }, i) => {
        const st = now ? statusAt(slot, now) : 'upcoming';
        const style = COURSE_COLOR_STYLES[course.color];
        const last = i === items.length - 1;
        return (
          <li key={slot.id} className="relative flex gap-4 pb-1">
            <div className="tabular w-12 shrink-0 pt-3 text-right">
              <p className={cn('text-body font-semibold', st === 'done' ? 'text-muted' : 'text-ink')}>{slot.startTime}</p>
              <p className="text-caption text-muted">{slot.endTime}</p>
            </div>
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  'mt-4 h-3 w-3 rounded-full border-2',
                  st === 'ongoing' ? 'border-heritage bg-heritage ring-4 ring-heritage/15' : st === 'done' ? 'border-line bg-line' : 'border-primary bg-surface',
                )}
                aria-hidden
              />
              {!last && <span className="w-px flex-1 bg-line" aria-hidden />}
            </div>
            <Row
              to={readOnly ? undefined : `/schedule/course/${course.id}`}
              className={cn('mb-3 flex min-w-0 flex-1 items-stretch overflow-hidden rounded-sm transition-colors hover:brightness-[0.98]', style.tint, st === 'done' && 'opacity-60')}
            >
              <span className={cn('w-1 shrink-0', style.bar)} aria-hidden />
              <span className="min-w-0 flex-1 px-3 py-2.5">
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('line-clamp-2 break-words text-body font-semibold', style.text)}>{courseTitle(course)}</span>
                  {now && <span className={cn('shrink-0 text-[11px] font-semibold', st === 'ongoing' ? 'text-heritage' : 'text-muted')}>{t(STATUS_LABEL[st])}</span>}
                </span>
                <span className="tabular mt-0.5 block truncate text-caption text-muted">
                  {[slot.room ? roomWithBuilding(slot.room) : t('common.roomNotSet'), course.instructor, formatPeriods(timesToPeriods(slot.startTime, slot.endTime))].filter(Boolean).join('　')}
                </span>
              </span>
            </Row>
          </li>
        );
      })}
    </ol>
  );
}
