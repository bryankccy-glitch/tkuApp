import { Link } from 'react-router-dom';
import type { Course, Weekday } from '@/lib/types';
import { occurrencesOn } from '@/lib/schedule';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { COURSE_COLOR_STYLES } from '@/lib/labels';
import { TKU_PERIODS } from '@/lib/periods';
import { toMinutes } from '@/lib/time';
import { cn } from '@/lib/cn';

const PX_PER_MIN = 1.1;

/** Week timetable aligned to TKU periods. Columns: Mon–Fri, plus weekend days that have classes. */
export function WeekGrid({ courses, today, conflictSlotIds }: { courses: Course[]; today: Weekday; conflictSlotIds: Set<string> }) {
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
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="sticky top-0 border-b border-line" />
        {days.map((d) => (
          <div key={d} className={cn('border-b border-l border-line py-2.5 text-center text-caption font-semibold', d === today ? 'text-heritage' : 'text-muted')}>
            {WEEKDAY_LABELS[d]}
            {d === today && <span className="ml-1 rounded-full bg-heritage/10 px-1.5 text-[10px]">今天</span>}
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {periods.map((p) => (
            <div key={p.no} className="tabular absolute inset-x-0 pr-2 text-right text-[10px] leading-tight text-muted" style={{ top: (toMinutes(p.start) - startMin) * PX_PER_MIN }}>
              <span className="block font-semibold text-ink/70">{p.no}</span>
              {p.start}
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
                <Link
                  key={slot.id}
                  to={`/schedule/course/${course.id}`}
                  className={cn('absolute inset-x-1 overflow-hidden rounded-xs px-2 py-1.5 transition-[filter] hover:brightness-95', st.tint, conflict && 'ring-2 ring-danger')}
                  style={{ top: top + 1, height: h - 2 }}
                  aria-label={`${WEEKDAY_LABELS[d]} ${slot.startTime}–${slot.endTime} ${course.name} ${slot.room}${conflict ? '（時間衝突）' : ''}`}
                >
                  <span className={cn('absolute inset-y-0 left-0 w-[3px]', st.bar)} aria-hidden />
                  <span className={cn('block text-[12px] font-semibold leading-tight', st.text)}>{course.name}</span>
                  <span className="tabular mt-0.5 block text-[11px] text-muted">{slot.room}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
