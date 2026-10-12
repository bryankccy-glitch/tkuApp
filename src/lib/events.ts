import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CampusEvent } from './types';

interface EventRow {
  id: string; title: string; category: CampusEvent['category']; summary: string; starts_at: string; ends_at: string | null;
  location: string | null; organizer: string; source_name: string; source_url: string; registration_url: string | null; published_at: string | null;
}

/** Published events maintained by admins in Supabase. Returns null when cloud is not configured. */
export function useCampusEvents() {
  return useQuery({
    queryKey: ['campus_events'],
    queryFn: async (): Promise<CampusEvent[] | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('campus_events')
        .select('id, title, category, summary, starts_at, ends_at, location, organizer, source_name, source_url, registration_url, published_at')
        .eq('status', 'published')
        .gte('starts_at', new Date(Date.now() - 86400_000).toISOString())
        .order('starts_at')
        .limit(100);
      if (error) throw new Error(error.message);
      return (data as EventRow[]).map((r) => ({
        id: r.id, title: r.title, category: r.category, summary: r.summary, startsAt: r.starts_at, endsAt: r.ends_at,
        location: r.location ?? undefined, organizer: r.organizer, sourceName: r.source_name, sourceUrl: r.source_url,
        registrationUrl: r.registration_url, publishedAt: r.published_at ?? r.starts_at,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

const BOOKMARK_KEY = 'tku.bookmarks';
export function readBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function writeBookmarks(ids: string[]) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
