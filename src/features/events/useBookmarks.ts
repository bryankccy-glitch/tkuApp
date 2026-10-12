import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/AuthProvider';
import { supabase } from '@/lib/supabase';
import { readBookmarks, writeBookmarks } from '@/lib/events';

/** Event bookmarks: Supabase `event_bookmarks` in cloud mode, localStorage in local mode. */
export function useBookmarks() {
  const { mode, session } = useAuth();
  const [ids, setIds] = useState<string[]>(() => (mode === 'local' ? readBookmarks() : []));

  useEffect(() => {
    if (mode !== 'cloud' || !supabase || !session) return;
    supabase.from('event_bookmarks').select('event_id').then(({ data }) => setIds((data ?? []).map((r) => r.event_id as string)));
  }, [mode, session]);

  const toggle = useCallback(
    async (id: string) => {
      const on = !ids.includes(id);
      const next = on ? [...ids, id] : ids.filter((x) => x !== id);
      setIds(next);
      if (mode === 'local') return writeBookmarks(next);
      if (!supabase) return;
      const res = on
        ? await supabase.from('event_bookmarks').insert({ event_id: id })
        : await supabase.from('event_bookmarks').delete().eq('event_id', id);
      if (res.error) setIds(ids); // roll back
    },
    [ids, mode],
  );

  return { ids, toggle };
}
