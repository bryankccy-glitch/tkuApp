-- TKU Campus OS — initial schema
-- UUID PKs, FKs, indexes, created_at/updated_at, RLS on every table.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '淡江同學' check (char_length(display_name) between 1 and 40),
  department text check (char_length(department) <= 60),
  grade text check (char_length(grade) <= 20),
  role text not null default 'student' check (role in ('student', 'admin')),
  current_semester_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin check used by policies. SECURITY DEFINER so it can read profiles regardless of caller RLS.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- Users may never promote themselves: role changes are blocked unless performed by service role.
create or replace function public.protect_profile_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'role can only be changed by the server';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '淡江同學'));
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;

-- ───────────────────────── semesters ─────────────────────────
-- user_id null  = shared semester maintained by admins
-- user_id set   = personal semester created by that user
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{2,3}-[12]$'),
  name text not null check (char_length(name) <= 40),
  start_date date not null,
  end_date date not null check (end_date > start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index semesters_user_idx on public.semesters (user_id);
create unique index semesters_user_code_uniq on public.semesters (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
create trigger semesters_updated_at before update on public.semesters for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_current_semester_fk foreign key (current_semester_id) references public.semesters (id) on delete set null;

-- ───────────────────────── course catalog (admin) ─────────────────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  code text not null,
  name text not null,
  instructor text,
  department text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester_id, code)
);
create index courses_name_idx on public.courses (semester_id, name);
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();

-- ───────────────────────── personal timetable ─────────────────────────
create table public.user_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  code text check (char_length(code) <= 20),
  instructor text check (char_length(instructor) <= 60),
  color text not null default 'navy' check (color in ('navy','blue','heritage','teal','amber','violet','slate')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_courses_user_sem_idx on public.user_courses (user_id, semester_id);
create trigger user_courses_updated_at before update on public.user_courses for each row execute function public.set_updated_at();

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  user_course_id uuid not null references public.user_courses (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text not null default '' check (char_length(room) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index schedule_entries_user_day_idx on public.schedule_entries (user_id, weekday, start_time);
create index schedule_entries_course_idx on public.schedule_entries (user_course_id);
create trigger schedule_entries_updated_at before update on public.schedule_entries for each row execute function public.set_updated_at();

-- An entry must belong to a course owned by the same user.
create or replace function public.check_schedule_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.user_courses uc where uc.id = new.user_course_id and uc.user_id = new.user_id) then
    raise exception 'schedule entry must reference your own course';
  end if;
  return new;
end $$;
create trigger schedule_entries_owner before insert or update on public.schedule_entries
  for each row execute function public.check_schedule_owner();

-- ───────────────────────── tasks ─────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  user_course_id uuid references public.user_courses (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  kind text not null default 'homework' check (kind in ('homework','report','quiz','midterm','final','personal')),
  due_at timestamptz not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  completed boolean not null default false,
  completed_at timestamptz,
  remind_minutes_before integer check (remind_minutes_before between 0 and 20160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on public.tasks (user_id, completed, due_at);
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

-- ───────────────────────── campus places ─────────────────────────
create table public.campus_places (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  name_en text,
  category text not null check (category in ('academic','library','admin','sports','culture','dining','service','gate','other')),
  description text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  coordinates_verified boolean not null default false,
  source_name text not null,
  source_url text not null,
  verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campus_places_category_idx on public.campus_places (category);
create trigger campus_places_updated_at before update on public.campus_places for each row execute function public.set_updated_at();

-- ───────────────────────── campus events ─────────────────────────
create table public.campus_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 120),
  category text not null check (category in ('campus','club','lecture','hackathon','programming','internship','scholarship','research','industry')),
  summary text not null default '' check (char_length(summary) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  organizer text not null,
  source_name text not null,
  source_url text not null check (source_url ~ '^https?://'),
  registration_url text check (registration_url is null or registration_url ~ '^https?://'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campus_events_published_idx on public.campus_events (status, starts_at);
create trigger campus_events_updated_at before update on public.campus_events for each row execute function public.set_updated_at();

create table public.event_bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index event_bookmarks_event_idx on public.event_bookmarks (event_id);

-- ───────────────────────── knowledge base (RAG) ─────────────────────────
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  source_url text not null unique check (source_url ~ '^https?://'),
  source_updated_at date,
  fetched_at timestamptz,
  content_hash text,
  status text not null default 'active' check (status in ('active','stale','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger knowledge_documents_updated_at before update on public.knowledge_documents for each row execute function public.set_updated_at();

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);
create trigger knowledge_chunks_updated_at before update on public.knowledge_chunks for each row execute function public.set_updated_at();

create or replace function public.match_knowledge_chunks(query_embedding extensions.vector(1536), match_count int default 6, min_similarity float default 0.75)
returns table (chunk_id uuid, document_id uuid, content text, similarity float, title text, publisher text, source_url text, source_updated_at date)
language sql stable set search_path = public, extensions as $$
  select c.id, d.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity,
         d.title, d.publisher, d.source_url, d.source_updated_at
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'active' and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 12);
$$;

-- ───────────────────────── AI conversations ─────────────────────────
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null default '新對話' check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 12000),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);
create trigger ai_messages_updated_at before update on public.ai_messages for each row execute function public.set_updated_at();

-- Rate-limit ledger written only by the server (service role).
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

-- ───────────────────────── misc ─────────────────────────
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  category text not null default 'general' check (category in ('general','bug','data','ai','feature')),
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  class_reminders boolean not null default true,
  class_remind_minutes integer not null default 10 check (class_remind_minutes between 0 and 120),
  task_reminders boolean not null default true,
  default_task_remind_minutes integer not null default 1440 check (default_task_remind_minutes between 0 and 20160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_audit_logs_time_idx on public.admin_audit_logs (created_at desc);

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Delete the calling user's account (cascades to all personal rows).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- RAG search is server-only (service role); clients never call it directly.
revoke all on function public.match_knowledge_chunks(extensions.vector, int, float) from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.user_courses enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.campus_places enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_bookmarks enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.feedback enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.admin_audit_logs enable row level security;

-- profiles: own row only
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- semesters: read shared + own; write own only
create policy semesters_select on public.semesters for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy semesters_insert_own on public.semesters for insert to authenticated with check (user_id = (select auth.uid()));
create policy semesters_update_own on public.semesters for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy semesters_delete_own on public.semesters for delete to authenticated using (user_id = (select auth.uid()));

-- course catalog: read for signed-in users; writes via server (service role) only
create policy courses_select on public.courses for select to authenticated using (true);

-- personal data: owner-only for every operation
create policy user_courses_owner on public.user_courses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy schedule_entries_owner on public.schedule_entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tasks_owner on public.tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy event_bookmarks_owner on public.event_bookmarks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_conversations_owner on public.ai_conversations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_messages_owner on public.ai_messages for all to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
create policy notification_preferences_owner on public.notification_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- public reference data
create policy campus_places_select on public.campus_places for select to anon, authenticated using (true);
create policy campus_events_select on public.campus_events for select to anon, authenticated using (status = 'published');
create policy knowledge_documents_select on public.knowledge_documents for select to authenticated using (status = 'active');
-- knowledge_chunks: no client policy → only the server (service role) reads them.

-- feedback: users may submit, and read their own
create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = (select auth.uid()));
create policy feedback_select_own on public.feedback for select to authenticated using (user_id = (select auth.uid()));

-- ai_usage & admin_audit_logs: no client policies (service role only).
-- Admin reads of audit logs go through the server after is_admin() verification.
