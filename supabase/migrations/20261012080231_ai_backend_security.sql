-- TKU Campus OS AI backend hardening.
-- Explicit grants are needed on projects with automatic Data API exposure disabled.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to service_role;

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

-- Replace a document's metadata and vectors atomically so an interrupted import
-- cannot leave a new hash paired with stale or partial chunks.
create or replace function public.ingest_knowledge_document(
  p_title text,
  p_publisher text,
  p_source_url text,
  p_source_updated_at date,
  p_content_hash text,
  p_chunks jsonb
) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_document_id uuid;
  v_chunk jsonb;
begin
  if jsonb_typeof(p_chunks) is distinct from 'array' then
    raise exception 'chunks must be a non-empty JSON array';
  end if;
  if jsonb_array_length(p_chunks) = 0 then
    raise exception 'chunks must be a non-empty JSON array';
  end if;

  insert into public.knowledge_documents (title, publisher, source_url, source_updated_at, fetched_at, content_hash, status)
  values (p_title, p_publisher, p_source_url, p_source_updated_at, now(), p_content_hash, 'active')
  on conflict (source_url) do update set
    title = excluded.title,
    publisher = excluded.publisher,
    source_updated_at = excluded.source_updated_at,
    fetched_at = excluded.fetched_at,
    content_hash = excluded.content_hash,
    status = 'active'
  returning id into v_document_id;

  delete from public.knowledge_chunks where document_id = v_document_id;
  for v_chunk in select value from jsonb_array_elements(p_chunks)
  loop
    insert into public.knowledge_chunks (document_id, chunk_index, content, embedding)
    values (
      v_document_id,
      (v_chunk ->> 'chunk_index')::integer,
      v_chunk ->> 'content',
      (v_chunk ->> 'embedding')::extensions.vector(1536)
    );
  end loop;
  return v_document_id;
end;
$$;
revoke all on function public.ingest_knowledge_document(text, text, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_knowledge_document(text, text, text, date, text, jsonb) to service_role;
