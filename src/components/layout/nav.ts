import { CalendarDays, Compass, Home, MessageCircleQuestion, UserRound, type LucideIcon } from 'lucide-react';

/** `label` is an i18n key. */
export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; primary?: boolean }

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'nav.home', icon: Home, end: true },
  { to: '/schedule', label: 'nav.schedule', icon: CalendarDays },
  { to: '/assistant', label: 'nav.assistant', icon: MessageCircleQuestion, primary: true },
  { to: '/explore', label: 'nav.explore', icon: Compass },
  { to: '/me', label: 'nav.me', icon: UserRound },
];
