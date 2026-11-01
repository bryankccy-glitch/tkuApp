-- A task may only reference the owner's own course. api/widget.ts also checks this, because it uses
-- the service role. Existing rows are not touched; the trigger applies to new writes.
create or replace function public.tasks_course_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_course_id is not null and not exists (
    select 1 from public.user_courses c
    where c.id = new.user_course_id and c.user_id = new.user_id
  ) then
    raise exception 'course does not belong to this user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_course_owner before insert or update of user_course_id, user_id on public.tasks
  for each row execute function public.tasks_course_owner();
