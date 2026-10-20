-- Machine-translated interface strings (api/translate.ts). Server-only cache: one row per language per
-- version of the English source strings. Not personal data.
create table public.ui_translations (
  lang text not null check (lang ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  version text not null check (version ~ '^[0-9a-f]{12}$'),
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (lang, version)
);
alter table public.ui_translations enable row level security; -- service role only
revoke all on public.ui_translations from anon, authenticated;
grant all on public.ui_translations to service_role;
