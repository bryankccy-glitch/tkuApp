import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router-dom';
import { AppShell, Page } from '@/components/layout/AppShell';
import { useAuth } from './AuthProvider';
import { SemesterProvider } from './SemesterProvider';
import { LoadingMark } from '@/components/brand/Logo';
import { EmptyState } from '@/components/ui/misc';
import DashboardPage from '@/features/dashboard/DashboardPage';

const SchedulePage = lazy(() => import('@/features/schedule/SchedulePage'));
const CourseDetailPage = lazy(() => import('@/features/schedule/CourseDetailPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const AssistantPage = lazy(() => import('@/features/ai/AssistantPage'));
const ExplorePage = lazy(() => import('@/features/explore/ExplorePage'));
const EventsPage = lazy(() => import('@/features/events/EventsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const AboutPage = lazy(() => import('@/features/profile/AboutPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, repo } = useAuth();
  if (loading) return <LoadingMark label="確認登入狀態" />;
  if (!repo) return <Navigate to="/login" replace />;
  return <SemesterProvider>{children}</SemesterProvider>;
}

function NotFound() {
  return (
    <Page>
      <EmptyState title="找不到這個頁面" body="網址可能有誤，或頁面已移動。" action={<Link to="/" className="font-semibold text-blue hover:underline">回到首頁</Link>} />
    </Page>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'schedule/course/:id', element: <CourseDetailPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'assistant', element: <AssistantPage /> },
          { path: 'explore', element: <ExplorePage /> },
          { path: 'events', element: <EventsPage /> },
          { path: 'me', element: <ProfilePage /> },
          { path: 'about', element: <AboutPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
