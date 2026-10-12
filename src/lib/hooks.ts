import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useRepo } from '@/app/AuthProvider';
import type { CourseInput, SemesterInput, TaskInput } from './data/repository';
import type { Profile } from './types';

const keys = {
  profile: ['profile'] as const,
  semesters: ['semesters'] as const,
  courses: (sem: string) => ['courses', sem] as const,
  tasks: ['tasks'] as const,
};

function useUserKey() {
  const { session, mode } = useAuth();
  return mode === 'local' ? 'local' : (session?.user.id ?? 'anon');
}

export function useProfile() {
  const repo = useRepo();
  const u = useUserKey();
  return useQuery({ queryKey: [u, ...keys.profile], queryFn: () => repo.getProfile() });
}

export function useUpdateProfile() {
  const repo = useRepo();
  const qc = useQueryClient();
  const u = useUserKey();
  return useMutation({
    mutationFn: (p: Partial<Omit<Profile, 'id'>>) => repo.updateProfile(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: [u, ...keys.profile] }),
  });
}

export function useSemesters() {
  const repo = useRepo();
  const u = useUserKey();
  return useQuery({ queryKey: [u, ...keys.semesters], queryFn: () => repo.listSemesters() });
}

export function useUpsertSemester() {
  const repo = useRepo();
  const qc = useQueryClient();
  const u = useUserKey();
  return useMutation({
    mutationFn: (s: SemesterInput) => repo.upsertSemester(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: [u, ...keys.semesters] }),
  });
}

export function useCourses(semesterId: string | undefined) {
  const repo = useRepo();
  const u = useUserKey();
  return useQuery({
    queryKey: [u, ...keys.courses(semesterId ?? '')],
    queryFn: () => repo.listCourses(semesterId!),
    enabled: Boolean(semesterId),
  });
}

export function useCourseMutations(semesterId: string | undefined) {
  const repo = useRepo();
  const qc = useQueryClient();
  const u = useUserKey();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [u, 'courses'] });
    qc.invalidateQueries({ queryKey: [u, ...keys.tasks] });
  };
  return {
    save: useMutation({ mutationFn: (c: CourseInput) => repo.upsertCourse(c), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => repo.deleteCourse(id), onSuccess: invalidate }),
    importMany: useMutation({
      mutationFn: async (list: Omit<CourseInput, 'semesterId'>[]) => {
        if (!semesterId) throw new Error('尚未選擇學期');
        for (const c of list) await repo.upsertCourse({ ...c, semesterId });
      },
      onSuccess: invalidate,
    }),
  };
}

export function useTasks() {
  const repo = useRepo();
  const u = useUserKey();
  return useQuery({ queryKey: [u, ...keys.tasks], queryFn: () => repo.listTasks() });
}

export function useTaskMutations() {
  const repo = useRepo();
  const qc = useQueryClient();
  const u = useUserKey();
  const invalidate = () => qc.invalidateQueries({ queryKey: [u, ...keys.tasks] });
  return {
    save: useMutation({ mutationFn: (t: TaskInput) => repo.upsertTask(t), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => repo.deleteTask(id), onSuccess: invalidate }),
  };
}

/** Current time, re-rendering every `intervalMs` (default 30s). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
