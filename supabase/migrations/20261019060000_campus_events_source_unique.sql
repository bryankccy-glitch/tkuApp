-- One row per source activity page, so the daily sync (api/sync-events.ts) can match rows by URL.
create unique index if not exists campus_events_source_url_uniq on public.campus_events (source_url);
