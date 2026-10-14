import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, createHashRouter, Link, Navigate, Outlet } from 'react-router-dom';
import { AppShell, Page } from '@/components/layout/AppShell';
import { useAuth } from './AuthProvider';
import { SemesterProvider } from './SemesterProvider';
import { BootScreen } from '@/components/brand/Logo';
import { EmptyState } from '@/components/ui/misc';
import { t } from '@/i18n/t';
import DashboardPage from '@/features/dashboard/DashboardPage';

const SchedulePage = lazy(() => import('@/features/schedule/SchedulePage'));
const CourseDetailPage = lazy(() => import('@/features/schedule/CourseDetailPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const AssistantPage = lazy(() => import('@/features/ai/AssistantPage'));
const ExplorePage = lazy(() => import('@/features/explore/ExplorePage'));
const EventsPage = lazy(() => import('@/features/events/EventsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const AboutPage = lazy(() => import('@/features/profile/AboutPage'));
const MarketPage = lazy(() => import('@/features/market/MarketPage'));
const MarketPostPage = lazy(() => import('@/features/market/MarketPostPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, repo } = useAuth();
  if (loading) return <BootScreen label={t('common.checkingSignIn')} />;
  if (!repo) return <Navigate to="/login" replace />;
  return <SemesterProvider>{children}</SemesterProvider>;
}

function NotFound() {
  return (
    <Page>
      <EmptyState title={t('common.notFoundTitle')} body={t('common.notFoundBody')} action={<Link to="/" className="font-semibold text-link hover:underline">{t('common.backHome')}</Link>} />
    </Page>
  );
}

// Hash routing only for hosted preview builds (no server-side SPA rewrite available).
const createRouter = import.meta.env.VITE_HASH_ROUTER === '1' ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
          { path: 'market', element: <MarketPage /> },
          { path: 'market/:id', element: <MarketPostPage /> },
          { path: 'me', element: <ProfilePage /> },
          { path: 'about', element: <AboutPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
