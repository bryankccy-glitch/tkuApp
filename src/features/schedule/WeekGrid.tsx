import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Course, Weekday } from '@/lib/types';
import { occurrencesOn } from '@/lib/schedule';
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from '@/lib/labels';
import { COURSE_COLOR_STYLES } from '@/lib/labels';
import { TKU_PERIODS } from '@/lib/periods';
import { toMinutes } from '@/lib/time';
import { cn } from '@/lib/cn';
import { t } from '@/i18n/t';
import { courseTitle } from '@/lib/courseTitle';

const PX_PER_MIN = 0.95;

function Block({ to, children, ...rest }: { to?: string; children: ReactNode; className?: string; style?: CSSProperties; 'aria-label'?: string }) {
  if (to) return <Link to={to} {...rest}>{children}</Link>;
  return <div role="group" {...rest}>{children}</div>;
}

/** Phone week timetable aligned to TKU periods. Mon–Fri, plus weekend days that have classes; fits without sideways scrolling. */
export function WeekGrid({ courses, today, conflictSlotIds, readOnly }: { courses: Course[]; today: Weekday; conflictSlotIds: Set<string>; /** A friend's timetable: blocks are not links. */ readOnly?: boolean }) {
  const days: Weekday[] = [1, 2, 3, 4, 5];
  ([6, 7] as Weekday[]).forEach((d) => {
    if (occurrencesOn(courses, d).length) days.push(d);
  });
  const all = courses.flatMap((c) => c.slots);
  const startMin = Math.min(toMinutes('08:00'), ...all.map((s) => toMinutes(s.startTime) - 10));
  const endMin = Math.max(toMinutes('18:00'), ...all.map((s) => toMinutes(s.endTime) + 10));
  const height = (endMin - startMin) * PX_PER_MIN;
  const periods = TKU_PERIODS.filter((p) => toMinutes(p.start) >= startMin && toMinutes(p.end) <= endMin);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid" style={{ gridTemplateColumns: `2rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="sticky top-0 border-b border-line" />
        {days.map((d) => (
          <div key={d} className={cn('border-b border-l border-line py-2 text-center text-caption font-semibold', d === today ? 'bg-primary/[0.06] text-primary' : 'text-muted')}>
            <span aria-hidden>{WEEKDAY_SHORT[d]}</span>
            <span className="sr-only">{WEEKDAY_LABELS[d]}{d === today ? t('week.today') : ''}</span>
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {periods.map((p) => (
            <div key={p.no} className="tabular absolute inset-x-0 pt-0.5 text-center text-[11px] font-semibold leading-tight text-muted" style={{ top: (toMinutes(p.start) - startMin) * PX_PER_MIN }} title={t('week.periodTitle', { n: p.no, start: p.start, end: p.end })}>
              {p.no}
            </div>
          ))}
        </div>

        {days.map((d) => (
          <div key={d} className={cn('relative border-l border-line', d === today && 'bg-heritage/[0.025]')} style={{ height }}>
            {periods.map((p) => (
              <div key={p.no} className="absolute inset-x-0 border-t border-dashed border-line/70" style={{ top: (toMinutes(p.start) - startMin) * PX_PER_MIN }} aria-hidden />
            ))}
            {occurrencesOn(courses, d).map(({ course, slot }) => {
              const top = (toMinutes(slot.startTime) - startMin) * PX_PER_MIN;
              const h = (toMinutes(slot.endTime) - toMinutes(slot.startTime)) * PX_PER_MIN;
              const st = COURSE_COLOR_STYLES[course.color];
              const conflict = conflictSlotIds.has(slot.id);
              return (
                <Block
                  key={slot.id}
                  to={readOnly ? undefined : `/schedule/course/${course.id}`}
                  className={cn('absolute inset-x-0.5 overflow-hidden rounded-[5px] py-1 pl-1.5 pr-0.5 transition-[filter] active:brightness-95', st.tint, conflict && 'ring-2 ring-inset ring-danger')}
                  style={{ top: top + 1, height: h - 2 }}
                  aria-label={`${WEEKDAY_LABELS[d]} ${slot.startTime}–${slot.endTime} ${courseTitle(course)} ${slot.room}${conflict ? t('week.conflict') : ''}`}
                >
                  <span className={cn('absolute inset-y-0 left-0 w-[3px]', st.bar)} aria-hidden />
                  <span className={cn('line-clamp-3 break-all text-[11px] font-semibold leading-[1.25]', st.text)}>{courseTitle(course)}</span>
                  <span className="tabular mt-0.5 block truncate text-[10px] text-muted">{slot.room}</span>
                </Block>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
