-- Verifies user A cannot read user B's private schedule, tasks, or AI messages.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

create temporary table rls_fixture_ids (key text primary key, id uuid not null);
insert into rls_fixture_ids values
  ('user_a', gen_random_uuid()),
  ('user_b', gen_random_uuid()),
  ('semester', gen_random_uuid()),
  ('course', gen_random_uuid()),
  ('user_course', gen_random_uuid()),
  ('schedule', gen_random_uuid()),
  ('task', gen_random_uuid()),
  ('conversation', gen_random_uuid()),
  ('message', gen_random_uuid());

select set_config('test.user_a', (select id::text from rls_fixture_ids where key='user_a'), true);
select set_config('test.user_course', (select id::text from rls_fixture_ids where key='user_course'), true);
select set_config('test.schedule', (select id::text from rls_fixture_ids where key='schedule'), true);
select set_config('test.task', (select id::text from rls_fixture_ids where key='task'), true);
select set_config('test.message', (select id::text from rls_fixture_ids where key='message'), true);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, 'authenticated', 'authenticated', id::text || '@rls-test.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()
from rls_fixture_ids where key in ('user_a', 'user_b');

insert into public.semesters (id, user_id, code, name, start_date, end_date)
select (select id from rls_fixture_ids where key='semester'), (select id from rls_fixture_ids where key='user_b'), '99-1', 'RLS fixture', '2099-01-01', '2099-06-30';
insert into public.user_courses (id, user_id, semester_id, name)
select (select id from rls_fixture_ids where key='user_course'), (select id from rls_fixture_ids where key='user_b'), (select id from rls_fixture_ids where key='semester'), 'RLS private course';
insert into public.schedule_entries (id, user_id, user_course_id, weekday, start_time, end_time)
select (select id from rls_fixture_ids where key='schedule'), (select id from rls_fixture_ids where key='user_b'), (select id from rls_fixture_ids where key='user_course'), 1, '08:00', '09:00';
insert into public.tasks (id, user_id, title, due_at)
select (select id from rls_fixture_ids where key='task'), (select id from rls_fixture_ids where key='user_b'), 'RLS private task', '2099-01-01T00:00:00Z';
insert into public.ai_conversations (id, user_id, title)
select (select id from rls_fixture_ids where key='conversation'), (select id from rls_fixture_ids where key='user_b'), 'RLS private conversation';
insert into public.ai_messages (id, conversation_id, user_id, role, content)
select (select id from rls_fixture_ids where key='message'), (select id from rls_fixture_ids where key='conversation'), (select id from rls_fixture_ids where key='user_b'), 'assistant', 'RLS private message';

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);

select is((select count(*)::integer from public.user_courses where id=current_setting('test.user_course')::uuid), 0, 'user A cannot read user B user_courses');
select is((select count(*)::integer from public.schedule_entries where id=current_setting('test.schedule')::uuid), 0, 'user A cannot read user B schedule_entries');
select is((select count(*)::integer from public.tasks where id=current_setting('test.task')::uuid), 0, 'user A cannot read user B tasks');
select is((select count(*)::integer from public.ai_messages where id=current_setting('test.message')::uuid), 0, 'user A cannot read user B ai_messages');

select * from finish();
rollback;
