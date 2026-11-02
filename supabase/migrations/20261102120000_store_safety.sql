-- Store safety: blocking, comment and user reports, a moderation queue, suspension, recorded
-- acceptance of the market rules, a term filter, and server-set timestamps for the rate limits.

-- ───────────────── recorded acceptance of the rules ─────────────────
create table public.market_rule_acceptances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version integer not null,
  accepted_at timestamptz not null default now()
);
alter table public.market_rule_acceptances enable row level security;
create policy market_rule_acceptances_select on public.market_rule_acceptances for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.accept_market_rules(rules_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  insert into public.market_rule_acceptances (user_id, version) values ((select auth.uid()), rules_version)
  on conflict (user_id) do update set version = excluded.version, accepted_at = now();
end $$;
revoke all on function public.accept_market_rules(integer) from public, anon;
grant execute on function public.accept_market_rules(integer) to authenticated;

-- ───────────────── suspension and term filter (operators only) ─────────────────
create table public.suspended_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now()
);
alter table public.suspended_users enable row level security;

create table public.blocked_terms (term text primary key check (term = lower(term) and char_length(term) >= 2));
alter table public.blocked_terms enable row level security;
insert into public.blocked_terms (term) values
  ('代寫'), ('代考'), ('考古答案'), ('槍枝'), ('毒品'), ('大麻'), ('安非他命'), ('援交'), ('約砲'), ('裸照')
on conflict do nothing;

-- ───────────────── blocking ─────────────────
create table public.user_blocks (
  blocker uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked uuid not null references auth.users (id) on delete cascade,
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked);
alter table public.user_blocks enable row level security;
create policy user_blocks_select on public.user_blocks for select to authenticated using (blocker = (select auth.uid()));
create policy user_blocks_delete on public.user_blocks for delete to authenticated using (blocker = (select auth.uid()));

create or replace function public.is_blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker = (select auth.uid()) and blocked = other) or (blocker = other and blocked = (select auth.uid()))
  );
$$;
revoke all on function public.is_blocked_with(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;

-- Blocking also ends any friendship or request, which closes timetable sharing at once.
create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not authenticated'; end if;
  if target = me then raise exception 'cannot block yourself'; end if;
  insert into public.user_blocks (blocker, blocked, blocked_name)
  values (me, target, coalesce((select display_name from public.profiles where id = target), ''))
  on conflict do nothing;
  delete from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.friendships_respect_blocks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.user_blocks
    where (blocker = new.requester and blocked = new.addressee) or (blocker = new.addressee and blocked = new.requester)
  ) then
    raise exception 'blocked';
  end if;
  return new;
end $$;
revoke all on function public.friendships_respect_blocks() from public, anon, authenticated;
create trigger friendships_respect_blocks before insert on public.friendships
  for each row execute function public.friendships_respect_blocks();

-- ───────────────── reports and the moderation queue ─────────────────
alter table public.market_posts add column hidden_at timestamptz;
alter table public.market_comments add column hidden_at timestamptz;
alter table public.market_reports add column status text not null default 'open' check (status in ('open', 'actioned', 'dismissed'));

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('comment', 'user')),
  target_id uuid not null,
  reporter uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('prohibited', 'scam', 'spam', 'harassment', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter)
);
create index content_reports_reporter_idx on public.content_reports (reporter);
create index content_reports_status_idx on public.content_reports (status, created_at);
alter table public.content_reports enable row level security;
create policy content_reports_insert on public.content_reports for insert to authenticated with check (reporter = (select auth.uid()));
create policy content_reports_select_own on public.content_reports for select to authenticated using (reporter = (select auth.uid()));

-- Three different reporters hide content until an operator reviews it.
create or replace function public.hide_reported_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.market_reports where post_id = new.post_id and status = 'open') >= 3 then
    update public.market_posts set hidden_at = coalesce(hidden_at, now()) where id = new.post_id;
  end if;
  return new;
end $$;
create or replace function public.hide_reported_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.target_type = 'comment' and (select count(*) from public.content_reports
      where target_type = 'comment' and target_id = new.target_id and status = 'open') >= 3 then
    update public.market_comments set hidden_at = coalesce(hidden_at, now()) where id = new.target_id;
  end if;
  return new;
end $$;
revoke all on function public.hide_reported_post() from public, anon, authenticated;
revoke all on function public.hide_reported_comment() from public, anon, authenticated;
create trigger market_reports_hide after insert on public.market_reports for each row execute function public.hide_reported_post();
create trigger content_reports_hide after insert on public.content_reports for each row execute function public.hide_reported_comment();

-- Operators read this with the service role; clients have no access.
create view public.moderation_queue with (security_invoker = true) as
  select 'post' as target_type, r.post_id as target_id, r.reason, r.note, r.reporter, r.created_at
    from public.market_reports r where r.status = 'open'
  union all
  select c.target_type, c.target_id, c.reason, c.note, c.reporter, c.created_at
    from public.content_reports c where c.status = 'open'
  order by created_at;
revoke all on public.moderation_queue from public, anon, authenticated;

-- ───────────────── feed visibility ─────────────────
drop policy market_posts_select on public.market_posts;
create policy market_posts_select on public.market_posts for select to authenticated using (
  user_id = (select auth.uid()) or (hidden_at is null and not public.is_blocked_with(user_id))
);
drop policy market_comments_select on public.market_comments;
create policy market_comments_select on public.market_comments for select to authenticated using (
  user_id = (select auth.uid()) or (hidden_at is null and not public.is_blocked_with(user_id))
);

-- ───────────────── writing to the market ─────────────────
create or replace function public.market_stamp_author() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  content text;
begin
  content := lower(case when tg_table_name = 'market_posts' then new.title || ' ' || new.description else new.body end);
  if exists (select 1 from public.blocked_terms t where position(t.term in content) > 0) then
    raise exception 'blocked term';
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    new.hidden_at := old.hidden_at;
    return new;
  end if;
  new.user_id := (select auth.uid());
  if new.user_id is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.suspended_users where user_id = new.user_id) then raise exception 'account suspended'; end if;
  if not exists (select 1 from public.market_rule_acceptances where user_id = new.user_id) then raise exception 'rules required'; end if;
  new.created_at := now();
  new.hidden_at := null;
  new.author_name := coalesce((select display_name from public.profiles where id = new.user_id), '淡江同學');
  if tg_table_name = 'market_posts' then
    if (select count(*) from public.market_posts where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate limit: at most 10 posts per day';
    end if;
  else
    if (select count(*) from public.market_comments where user_id = new.user_id and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate limit: at most 60 comments per hour';
    end if;
    if (select status from public.market_posts where id = new.post_id) = 'closed' then
      raise exception 'post is closed';
    end if;
    if exists (
      select 1 from public.market_posts p join public.user_blocks b
        on (b.blocker = p.user_id and b.blocked = new.user_id) or (b.blocker = new.user_id and b.blocked = p.user_id)
      where p.id = new.post_id
    ) then
      raise exception 'blocked';
    end if;
  end if;
  return new;
end $$;
