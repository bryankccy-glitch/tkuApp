-- Web Push for class / deadline reminders, so they arrive even when the app is closed.
-- The app stores its push subscription + reminder settings here; /api/push-reminders (service role),
-- called every minute by pg_cron, sends what is due and records it in push_sent (no duplicates).
create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  p256dh text not null,
  auth text not null,
  class_minutes smallint not null default 10 check (class_minutes between 0 and 120),
  tasks boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create trigger push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create table public.push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, reminder_id)
);
alter table public.push_sent enable row level security; -- service role only
revoke all on public.push_sent from anon, authenticated;
grant all on public.push_sent to service_role;

-- Every minute: call the Vercel function. The shared secret lives in Vault as 'cron_secret'
-- (set by the developer: select vault.create_secret('<CRON_SECRET>', 'cron_secret');).
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule(
  'push-reminders',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://tku-app.vercel.app/api/push-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')),
    timeout_milliseconds := 20000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')
    and exists (select 1 from public.push_subscriptions);
  $$
);
select cron.schedule('push-sent-cleanup', '17 4 * * *', $$ delete from public.push_sent where sent_at < now() - interval '3 days' $$);
