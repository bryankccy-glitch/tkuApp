-- TKU Campus OS AI backend hardening.
-- Explicit grants are needed on projects with automatic Data API exposure disabled.
grant usage on schema public to anon, authenticated, service_role;

grant select on table public.campus_places, public.campus_events to anon;
grant select, insert, update, delete on table
  public.profiles, public.semesters, public.user_courses, public.schedule_entries,
  public.tasks, public.event_bookmarks, public.ai_conversations, public.ai_messages,
  public.feedback, public.notification_preferences
to authenticated;
grant select on table public.courses, public.campus_places, public.campus_events, public.knowledge_documents to authenticated;
grant select, insert, update, delete on table public.ai_usage, public.knowledge_documents, public.knowledge_chunks to service_role;

revoke all on table public.ai_usage, public.knowledge_chunks from anon, authenticated;
revoke all on function public.match_knowledge_chunks(extensions.vector, integer, double precision) from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(extensions.vector, integer, double precision) to service_role;
