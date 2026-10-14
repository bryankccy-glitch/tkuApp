-- Disposable fixtures only; the entire transaction is rolled back.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); eid uuid := gen_random_uuid();
begin
  perform set_config('test.calendar_a', a::text, true);
  perform set_config('test.calendar_b', b::text, true);
  perform set_config('test.calendar_b_event', eid::text, true);
  insert into auth.users(id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (a, 'authenticated', 'authenticated', a::text || '@calendar-rls.invalid', '', '{}', '{}', now(), now()),
         (b, 'authenticated', 'authenticated', b::text || '@calendar-rls.invalid', '', '{}', '{}', now(), now());
  insert into public.calendar_events(id, user_id, title, kind, starts_at, ends_at)
  values (eid, b, 'Private B fixture', 'work', '2099-01-01T10:00:00+08:00', '2099-01-01T11:00:00+08:00');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.calendar_a'), true);
do $$
declare n integer; rejected boolean := false;
begin
  insert into public.calendar_events(title, kind, starts_at, ends_at)
  values ('Private A fixture', 'work', '2099-01-01T10:00:00+08:00', '2099-01-01T11:00:00+08:00');
  if (select count(*) from public.calendar_events) <> 1 then raise exception 'A own read failed'; end if;
  if exists(select 1 from public.calendar_events where id=current_setting('test.calendar_b_event')::uuid) then raise exception 'A read B'; end if;
  update public.calendar_events set title='Updated A fixture';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A own update failed'; end if;
  begin
    insert into public.calendar_events(user_id, title, kind, starts_at, ends_at)
    values (current_setting('test.calendar_b')::uuid, 'Forged B fixture', 'work', '2099-01-01T10:00:00+08:00', '2099-01-01T11:00:00+08:00');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'A forged B insert'; end if;
  rejected := false;
  begin
    update public.calendar_events set user_id=current_setting('test.calendar_b')::uuid where user_id=current_setting('test.calendar_a')::uuid;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'A reassigned ownership'; end if;
  update public.calendar_events set title='Unauthorized' where id=current_setting('test.calendar_b_event')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A updated B'; end if;
  delete from public.calendar_events where id=current_setting('test.calendar_b_event')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A deleted B'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.calendar_b'), true);
do $$
declare n integer;
begin
  if (select count(*) from public.calendar_events) <> 1 then raise exception 'B sees A or cannot read own event'; end if;
  delete from public.calendar_events where id=current_setting('test.calendar_b_event')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B own delete failed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare rejected boolean := false;
begin
  begin perform 1 from public.calendar_events;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Anon can read calendar events'; end if;
  rejected := false;
  begin insert into public.calendar_events(title, kind, starts_at, ends_at) values ('Anon fixture', 'work', now(), now() + interval '1 hour');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Anon can insert calendar events'; end if;
end $$;
reset role;
select 'calendar RLS: all ownership and anonymous-access assertions passed' as result;
rollback;
