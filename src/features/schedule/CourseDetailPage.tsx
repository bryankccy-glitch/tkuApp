import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/Toast';
import { useSemester } from '@/app/SemesterProvider';
import { useCourseMutations, useCourses, useNow, useTasks } from '@/lib/hooks';
import { COURSE_COLOR_STYLES, TASK_KIND_LABELS, WEEKDAY_LABELS } from '@/lib/labels';
import { formatPeriods, timesToPeriods } from '@/lib/periods';
import { buildingFromRoom } from '@/data/places';
import { formatDue } from '@/lib/time';
import type { Weekday } from '@/lib/types';
import { CourseForm } from './CourseForm';
import { LoadingMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { semesterLabel } from '@/lib/data/semesters';
import { t } from '@/i18n/t';

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const { semester } = useSemester();
  const { data: courses = [], isLoading } = useCourses(semester?.id);
  const { data: tasks = [] } = useTasks();
  const { save, remove } = useCourseMutations(semester?.id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <LoadingMark />;
  const course = courses.find((c) => c.id === id);
  if (!course) {
    return (
      <Page>
        <EmptyState title={t('course.notFound')} body={t('course.notFoundBody')} action={<Link to="/schedule" className="font-semibold text-link hover:underline">{t('course.backToSchedule')}</Link>} />
      </Page>
    );
  }
  const st = COURSE_COLOR_STYLES[course.color];
  const related = tasks.filter((t) => t.courseId === course.id && !t.completed).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <Page>
      <Link to="/schedule" className="mb-4 inline-flex items-center gap-1 text-caption font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />{t('schedule.title')}</Link>
      <header className="relative overflow-hidden rounded-lg bg-surface p-5 shadow-lift">
        <span className={cn('absolute inset-x-0 top-0 h-1.5', st.bar)} aria-hidden />
        <p className="text-caption text-muted">{[course.code, semester && semesterLabel(semester)].filter(Boolean).join('｜')}</p>
        <h1 className="mt-1 text-h1 text-ink">{course.name}</h1>
        <p className="mt-1 text-body text-muted">{course.instructor ? t('course.instructorLine', { name: course.instructor }) : t('course.noInstructor')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />{t('common.delete')}</Button>
        </div>
      </header>

      <section className="mt-6" aria-labelledby="slots-title">
        <h2 id="slots-title" className="mb-2 text-h3 text-ink">{t('course.slots')}</h2>
        <ul className="divide-y divide-line rounded-sm border border-line bg-surface">
          {[...course.slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)).map((s) => {
            const b = buildingFromRoom(s.room);
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className={cn('w-12 text-body font-semibold', st.text)}>{WEEKDAY_LABELS[s.weekday]}</span>
                <span className="tabular flex-1 text-body text-ink">
                  {s.startTime}–{s.endTime}
                  <span className="ml-2 text-caption text-muted">{formatPeriods(timesToPeriods(s.startTime, s.endTime))}</span>
                </span>
                {b ? (
                  <Link to={`/explore?place=${b.code}`} className="inline-flex items-center gap-1 text-caption font-semibold text-link hover:underline">
                    <MapPin className="h-3.5 w-3.5" />{s.room}<span className="text-muted">（{b.name}）</span>
                  </Link>
                ) : (
                  <span className="text-caption text-muted">{s.room || t('common.roomNotSet')}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {course.notes && (
        <section className="mt-6">
          <h2 className="mb-2 text-h3 text-ink">{t('course.notes')}</h2>
          <p className="whitespace-pre-wrap rounded-sm bg-sunken p-4 text-body text-ink">{course.notes}</p>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-h3 text-ink">{t('course.related')}</h2>
          <Link to={`/tasks?add=1&course=${course.id}`} className="text-caption font-semibold text-link hover:underline">{t('summary.add')}</Link>
        </div>
        {related.length ? (
          <ul className="divide-y divide-line rounded-sm border border-line bg-surface">
            {related.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 px-4 py-3 text-body">
                <span className="truncate text-ink">{TASK_KIND_LABELS[t.kind]}：{t.title}</span>
                <span className="tabular shrink-0 text-caption text-muted">{formatDue(t.dueAt, now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-muted">{t('course.noRelated')}</p>
        )}
      </section>

      <CourseForm
        open={editing}
        onClose={() => setEditing(false)}
        initial={course}
        courses={courses}
        saving={save.isPending}
        onSubmit={async (v) => {
          try {
            await save.mutateAsync({ ...v, id: course.id, semesterId: course.semesterId, slots: v.slots.map((s) => ({ ...s, weekday: s.weekday as Weekday, room: s.room.toUpperCase() })) });
            toast({ tone: 'success', message: t('common.saved') });
            setEditing(false);
          } catch (e) {
            toast({ tone: 'error', message: e instanceof Error ? e.message : t('common.saveFailed') });
          }
        }}
      />
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('course.deleteTitle', { name: course.name })}
        message={t('course.deleteBody')}
        confirmLabel={t('course.deleteConfirm')}
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(course.id);
          toast({ tone: 'success', message: t('course.deleted', { name: course.name }) });
          navigate('/schedule');
        }}
      />
    </Page>
  );
}
