-- TKU Campus OS — social features: friend timetable sharing + 二手市集 (no payments).
-- All friend operations go through SECURITY DEFINER RPCs with explicit checks, so profiles
-- and timetables never become broadly readable through RLS.

-- ───────────────────────── friend codes ─────────────────────────
create or replace function public.gen_friend_code() returns text
language sql volatile set search_path = '' as $$
  -- 8 chars from an alphabet without look-alikes (no 0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

alter table public.profiles
  add column friend_code text not null default public.gen_friend_code();
create unique index profiles_friend_code_uniq on public.profiles (friend_code);

-- ───────────────────────── friendships ─────────────────────────
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index friendships_pair_uniq on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_requester_idx on public.friendships (requester);
create index friendships_addressee_idx on public.friendships (addressee);
create trigger friendships_updated_at before update on public.friendships for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;
-- Read-only for the two people involved; every write goes through the RPCs below.
create policy friendships_select_own on public.friendships for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));

-- Send a request by friend code. If the other person already asked you, this accepts it.
create or replace function public.send_friend_request(code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where friend_code = upper(trim(code));
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;

  select * into existing from public.friendships
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.addressee = me then
      update public.friendships set status = 'accepted' where id = existing.id;
      return 'accepted';
    end if;
    return 'pending';
  end if;

  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 30 then
    raise exception 'too many pending friend requests';
  end if;
  insert into public.friendships (requester, addressee) values (me, target);
  return 'sent';
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not authenticated'; end if;
  if accept then
    update public.friendships set status = 'accepted' where id = request_id and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = request_id and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'request not found'; end if;
end $$;

-- Cancel an outgoing request or remove a friend (either side).
create or replace function public.remove_friendship(friendship_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not authenticated'; end if;
  delete from public.friendships where id = friendship_id and (requester = me or addressee = me);
  if not found then raise exception 'friendship not found'; end if;
end $$;

-- Friends and pending requests with the minimum profile info needed to recognise someone.
create or replace function public.list_friends()
returns table (friendship_id uuid, friend_id uuid, display_name text, department text, status text, direction text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id,
         p.id,
         p.display_name,
         p.department,
         f.status,
         case when f.status = 'accepted' then 'friend' when f.requester = (select auth.uid()) then 'outgoing' else 'incoming' end,
         f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  where (select auth.uid()) in (f.requester, f.addressee)
  order by f.status desc, p.display_name;
$$;

-- A friend's timetable for the semester with the given code (e.g. '115-1'). Notes stay private.
create or replace function public.get_friend_schedule(friend uuid, semester_code text)
returns table (course_id uuid, name text, code text, instructor text, color text, entry_id uuid, weekday smallint, start_time time, end_time time, room text)
language sql stable security definer set search_path = '' as $$
  select uc.id, uc.name, uc.code, uc.instructor, uc.color, se.id, se.weekday, se.start_time, se.end_time, se.room
  from public.user_courses uc
  join public.semesters s on s.id = uc.semester_id
  join public.schedule_entries se on se.user_course_id = uc.id
  where uc.user_id = friend
    and s.code = semester_code
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester, f.addressee) = least(friend, (select auth.uid()))
        and greatest(f.requester, f.addressee) = greatest(friend, (select auth.uid()))
    )
  order by se.weekday, se.start_time;
$$;

-- Issue a new code (e.g. if the old one was posted publicly). Existing friends are unaffected.
create or replace function public.regenerate_friend_code() returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); c text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  loop
    c := public.gen_friend_code();
    begin
      update public.profiles set friend_code = c where id = me;
      return c;
    exception when unique_violation then
      -- extremely unlikely collision: try again
    end;
  end loop;
end $$;

revoke all on function public.gen_friend_code() from public, anon, authenticated;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
revoke all on function public.list_friends() from public, anon;
revoke all on function public.get_friend_schedule(uuid, text) from public, anon;
revoke all on function public.regenerate_friend_code() from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.get_friend_schedule(uuid, text) to authenticated;
grant execute on function public.regenerate_friend_code() to authenticated;

-- ───────────────────────── 二手市集 ─────────────────────────
-- The platform never handles money: posts + comments only, people arrange the meetup themselves.
create table public.market_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  author_name text not null default '',
  kind text not null check (kind in ('sell', 'want')),
  category text not null check (category in ('book', 'stationery', 'electronics', 'daily', 'other')),
  title text not null check (char_length(trim(title)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  price integer check (price between 0 and 100000),
  course_code text check (char_length(course_code) <= 20),
  condition text check (condition in ('new', 'like_new', 'good', 'fair')),
  status text not null default 'open' check (status in ('open', 'reserved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index market_posts_feed_idx on public.market_posts (status, created_at desc);
create index market_posts_user_idx on public.market_posts (user_id);
create trigger market_posts_updated_at before update on public.market_posts for each row execute function public.set_updated_at();

create table public.market_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.market_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  author_name text not null default '',
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index market_comments_post_idx on public.market_comments (post_id, created_at);
create index market_comments_user_idx on public.market_comments (user_id);

create table public.market_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.market_posts (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('prohibited', 'scam', 'spam', 'harassment', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, reporter)
);
create index market_reports_reporter_idx on public.market_reports (reporter);

-- Author names are copied from the author's own profile (clients can't spoof them),
-- and simple per-user rate limits keep the feed from being flooded.
create or replace function public.market_stamp_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.author_name := old.author_name;
    return new;
  end if;
  new.user_id := (select auth.uid());
  if new.user_id is null then raise exception 'not authenticated'; end if;
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
  end if;
  return new;
end $$;
revoke all on function public.market_stamp_author() from public, anon, authenticated;

create trigger market_posts_stamp before insert or update on public.market_posts
  for each row execute function public.market_stamp_author();
create trigger market_comments_stamp before insert or update on public.market_comments
  for each row execute function public.market_stamp_author();

alter table public.market_posts enable row level security;
alter table public.market_comments enable row level security;
alter table public.market_reports enable row level security;

-- Signed-in students can browse; only the author can edit / delete their post.
create policy market_posts_select on public.market_posts for select to authenticated using (true);
create policy market_posts_insert on public.market_posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy market_posts_update on public.market_posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy market_posts_delete on public.market_posts for delete to authenticated using (user_id = (select auth.uid()));

create policy market_comments_select on public.market_comments for select to authenticated using (true);
create policy market_comments_insert on public.market_comments for insert to authenticated with check (user_id = (select auth.uid()));
-- Commenters can delete their own comments; post authors can tidy their own thread.
create policy market_comments_delete on public.market_comments for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.market_posts p where p.id = post_id and p.user_id = (select auth.uid()))
);

create policy market_reports_insert on public.market_reports for insert to authenticated with check (reporter = (select auth.uid()));
create policy market_reports_select_own on public.market_reports for select to authenticated using (reporter = (select auth.uid()));
