-- Home-screen widget access (Scriptable). One token per user; only its SHA-256 hash is stored.
-- The app creates/revokes its own row; /api/widget (service role) looks the hash up to read that
-- user's schedule and tasks. The token itself is shown to the user once and never stored.
create table public.widget_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.widget_tokens enable row level security;

create policy widget_tokens_select on public.widget_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy widget_tokens_insert on public.widget_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy widget_tokens_delete on public.widget_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.widget_tokens from anon;
grant select, insert, delete on public.widget_tokens to authenticated;
grant all on public.widget_tokens to service_role;
