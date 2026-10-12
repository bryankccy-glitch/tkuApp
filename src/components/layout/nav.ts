import { CalendarDays, Compass, Home, MessageCircleQuestion, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; primary?: boolean }

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: '首頁', icon: Home, end: true },
  { to: '/schedule', label: '課表', icon: CalendarDays },
  { to: '/assistant', label: 'AI 助理', icon: MessageCircleQuestion, primary: true },
  { to: '/explore', label: '探索', icon: Compass },
  { to: '/me', label: '我的', icon: UserRound },
];
