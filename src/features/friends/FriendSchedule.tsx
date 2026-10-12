import { useMemo, useState } from 'react';
import { ArrowLeft, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorNotice, Segmented } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { LoadingMark } from '@/components/brand/Logo';
import { socialErrorMessage, useFriendMutations, useFriendSchedule } from '@/lib/social/hooks';
import { commonFreeBlocks } from '@/lib/social/freeTime';
import type { FriendEntry } from '@/lib/social/types';
import type { Course, Weekday } from '@/lib/types';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { formatPeriods } from '@/lib/periods';
import { weekdayOf } from '@/lib/time';
import { useNow } from '@/lib/hooks';
import { WeekGrid } from '@/features/schedule/WeekGrid';
import { Avatar } from './FriendsPanel';
import { t } from '@/i18n/t';

type View = 'week' | 'free';

export function FriendSchedule({ friend, myCourses, semesterCode, onBack }: { friend: FriendEntry; myCourses: Course[]; semesterCode?: string; onBack: () => void }) {
  const now = useNow();
  const toast = useToast();
  const { data: courses = [], isLoading, error, refetch } = useFriendSchedule(friend.friendId, semesterCode);
  const { remove } = useFriendMutations();
  const [view, setView] = useState<View>('week');
  const [confirm, setConfirm] = useState(false);
  const free = useMemo(() => commonFreeBlocks([myCourses, courses]), [myCourses, courses]);
  const byDay = useMemo(() => {
    const m = new Map<Weekday, typeof free>();
    for (const b of free) m.set(b.weekday, [...(m.get(b.weekday) ?? []), b]);
    return m;
  }, [free]);

  const unfriend = async () => {
    try {
      await remove.mutateAsync(friend.friendshipId);
      toast({ tone: 'success', message: t('friends.removed', { name: friend.displayName }) });
      onBack();
    } catch (e) {
      toast({ tone: 'error', message: socialErrorMessage(e) });
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-caption font-semibold text-link hover:underline">
        <ArrowLeft className="h-4 w-4" />{t('friends.back')}
      </button>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={friend.displayName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-h3 text-ink">{t('friends.scheduleOf', { name: friend.displayName })}</h2>
          <p className="text-caption text-muted">{[friend.department, semesterCode].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <Segmented<View>
        label={t('friends.viewLabel')}
        className="mb-4 w-fit"
        value={view}
        onChange={setView}
        options={[{ value: 'week', label: t('friends.theirWeek') }, { value: 'free', label: t('friends.commonFree'), count: free.length }]}
      />

      {isLoading ? <LoadingMark /> : error ? <ErrorNotice error={error} onRetry={() => refetch()} /> : view === 'week' ? (
        courses.length ? (
          <WeekGrid courses={courses} today={weekdayOf(now)} conflictSlotIds={new Set()} readOnly />
        ) : (
          <EmptyState compact title={t('friends.noCoursesTitle')} body={t('friends.noCoursesBody', { semester: semesterCode ?? '' })} />
        )
      ) : (
        <div>
          <p className="mb-3 text-caption text-muted">{t('friends.commonFreeHint')}</p>
          {free.length === 0 ? (
            <EmptyState compact title={t('friends.noCommonFree')} />
          ) : (
            <ul className="grid gap-2">
              {([1, 2, 3, 4, 5] as Weekday[]).filter((d) => byDay.has(d)).map((d) => (
                <li key={d} className="rounded-sm border border-line bg-surface px-4 py-3">
                  <p className="text-body font-semibold text-ink">{WEEKDAY_LABELS[d]}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {byDay.get(d)!.map((b) => (
                      <li key={b.from} className="tabular rounded-full bg-success/10 px-2.5 py-1 text-caption font-semibold text-success">
                        {b.startTime}–{b.endTime}
                        <span className="ml-1 font-normal opacity-80">{formatPeriods(Array.from({ length: b.to - b.from + 1 }, (_, i) => b.from + i))}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button variant="ghost" className="mt-6 w-full text-danger" onClick={() => setConfirm(true)}>
        <UserMinus className="h-4 w-4" />{t('friends.remove')}
      </Button>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={unfriend}
        loading={remove.isPending}
        title={t('friends.removeTitle', { name: friend.displayName })}
        message={t('friends.removeBody')}
        confirmLabel={t('friends.remove')}
      />
    </div>
  );
}
