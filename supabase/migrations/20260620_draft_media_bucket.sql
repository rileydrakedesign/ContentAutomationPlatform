-- Durable storage for media attached to drafts. X media_ids expire (~24h for
-- unused media), so for scheduled posts we re-upload from this bucket at publish
-- time. Public-read (the media is destined for a public X post anyway); writes
-- are restricted to the owning user's folder via the path prefix = auth.uid().
insert into storage.buckets (id, name, public, file_size_limit)
values ('draft-media', 'draft-media', true, 536870912)
on conflict (id) do nothing;

-- Owner-scoped writes; public reads (bucket is public).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'draft_media_owner_insert'
  ) then
    create policy draft_media_owner_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'draft-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'draft_media_owner_modify'
  ) then
    create policy draft_media_owner_modify on storage.objects
      for update to authenticated
      using (
        bucket_id = 'draft-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'draft_media_owner_delete'
  ) then
    create policy draft_media_owner_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'draft-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
