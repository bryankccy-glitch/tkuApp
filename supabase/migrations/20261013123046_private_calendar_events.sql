-- Personal calendar entries are separate from public campus events.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  kind text not null check (kind in ('work', 'appointment', 'study', 'club', 'personal')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location text not null default '' check (length(location) <= 160),
  notes text not null default '' check (length(notes) <= 2000),
  repeat text not null default 'none' check (repeat in ('none', 'weekly')),
  repeat_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (repeat_until is null or repeat_until >= (starts_at at time zone 'Asia/Taipei')::date),
  check (repeat = 'none' or ends_at - starts_at <= interval '7 days')
);
create index calendar_events_user_start_idx on public.calendar_events(user_id, starts_at);
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();
alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from anon, authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant all on public.calendar_events to service_role;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy calendar_events_insert on public.calendar_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy calendar_events_update on public.calendar_events for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendar_events_delete on public.calendar_events for delete to authenticated
  using ((select auth.uid()) = user_id);
