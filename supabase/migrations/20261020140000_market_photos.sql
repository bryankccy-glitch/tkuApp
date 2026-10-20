-- 二手市集 photos: up to 4 public URLs per post, files in the public bucket market-photos under
-- <user id>/<random>.jpg. Anyone can view (posts are public to signed-in users anyway); only the
-- owner can upload into or delete from their own folder. Images are downscaled in the app (≤ 1280 px JPEG).
alter table public.market_posts
  add column photos text[] not null default '{}'
  check (cardinality(photos) <= 4);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-photos', 'market-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy market_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'market-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy market_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'market-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
