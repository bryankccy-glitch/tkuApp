import { CalendarDays, Compass, Home, MessageCircleQuestion, UserRound, type LucideIcon } from 'lucide-react';

/** `label` is an i18n key. */
/** `also`: other path prefixes that keep this tab highlighted (e.g. 校園 covers 活動 and 市集). */
export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; primary?: boolean; also?: string[] }

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'nav.home', icon: Home, end: true },
  { to: '/schedule', label: 'nav.schedule', icon: CalendarDays },
  { to: '/assistant', label: 'nav.assistant', icon: MessageCircleQuestion, primary: true },
  { to: '/explore', label: 'nav.explore', icon: Compass, also: ['/events', '/market'] },
  { to: '/me', label: 'nav.me', icon: UserRound },
];

/** Same rule as NavLink (`end` = exact match), plus the item's extra `also` prefixes. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  const own = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  return own || Boolean(item.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
}
