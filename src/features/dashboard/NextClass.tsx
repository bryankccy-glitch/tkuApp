import { Link } from 'react-router-dom';
import { BellPlus, MapPin, UserRound } from 'lucide-react';
import type { NextClass as NextClassT } from '@/lib/schedule';
import { formatCountdown, formatDateShort, formatTime, isSameDay } from '@/lib/time';
import { formatPeriods, timesToPeriods } from '@/lib/periods';
import { buildingFromRoom } from '@/data/places';
import { COURSE_COLOR_STYLES } from '@/lib/labels';
import { downloadIcs } from '@/lib/ics';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

export function NextClassCard({ next, now }: { next: NextClassT | null; now: Date }) {
  const toast = useToast();
  if (!next) {
    return (
      <section aria-labelledby="next-class" className="rounded-lg border border-dashed border-line bg-surface px-5 py-6">
        <h2 id="next-class" className="text-label text-muted">下一堂課</h2>
        <p className="mt-2 text-h3 text-ink">這週沒有排課</p>
        <p className="mt-1 text-caption text-muted">把課程加進課表，這裡會顯示下一堂課的教室與倒數時間。</p>
        <Link to="/schedule?add=1" className="mt-4 inline-flex h-10 items-center rounded-sm bg-primary px-4 font-semibold text-white dark:text-[#1A0506]">新增課程</Link>
      </section>
    );
  }
  const { course, slot, startsAt, endsAt, ongoing } = next;
  const building = buildingFromRoom(slot.room);
  const style = COURSE_COLOR_STYLES[course.color];
  const day = isSameDay(startsAt, now) ? '今天' : formatDateShort(startsAt);
  const periods = formatPeriods(timesToPeriods(slot.startTime, slot.endTime));

  const addReminder = () => {
    downloadIcs(
      {
        uid: `${course.id}-${slot.id}-${startsAt.getTime()}`,
        title: `${course.name}（${slot.room || '教室未填'}）`,
        start: startsAt,
        end: endsAt,
        location: building ? `淡江大學 ${building.name} ${slot.room}` : slot.room,
        description: course.instructor ? `授課教師：${course.instructor}` : undefined,
        alarmMinutesBefore: 10,
      },
      `${course.name}-提醒.ics`,
    );
    toast({ tone: 'success', message: '已產生行事曆提醒檔，開啟即可加入手機行事曆（課前 10 分鐘提醒）' });
  };

  return (
    <section aria-labelledby="next-class" className="relative overflow-hidden rounded-lg bg-surface shadow-lift">
      <span className={cn('absolute inset-y-0 left-0 w-1.5', style.bar)} aria-hidden />
      <div className="px-5 py-5 pl-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="next-class" className="text-label text-muted">{ongoing ? '正在上課' : '下一堂課'}</h2>
          <span className={cn('tabular rounded-full px-2.5 py-1 text-caption font-semibold', ongoing ? 'bg-success/10 text-success' : 'bg-heritage/10 text-heritage')}>
            {ongoing ? `${formatTime(endsAt)} 下課` : formatCountdown(startsAt.getTime() - now.getTime())}
          </span>
        </div>
        <Link to={`/schedule/course/${course.id}`} className="mt-2 block text-h2 text-ink hover:underline">{course.name}</Link>
        <p className="tabular mt-1 text-body text-muted">
          {day} {slot.startTime}–{slot.endTime}{periods && `　${periods}`}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <div>
            <dt className="flex items-center gap-1 text-caption text-muted"><MapPin className="h-3.5 w-3.5" />教室</dt>
            <dd className="tabular mt-0.5 text-h3 text-ink">{slot.room || '未填寫'}</dd>
            {building && <dd className="text-caption text-muted">{building.name}</dd>}
          </div>
          <div>
            <dt className="flex items-center gap-1 text-caption text-muted"><UserRound className="h-3.5 w-3.5" />授課教師</dt>
            <dd className="mt-0.5 text-body font-semibold text-ink">{course.instructor || '未填寫'}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {building && (
            <Link to={`/explore?place=${building.code}`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-3 text-caption font-semibold text-ink hover:bg-sunken">
              <MapPin className="h-4 w-4" />查看教室位置
            </Link>
          )}
          {!ongoing && (
            <button type="button" onClick={addReminder} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-3 text-caption font-semibold text-ink hover:bg-sunken">
              <BellPlus className="h-4 w-4" />加入提醒
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
