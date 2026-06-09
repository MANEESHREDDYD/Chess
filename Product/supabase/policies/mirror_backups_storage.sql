-- 1. Create the private bucket
insert into storage.buckets (id, name, public)
values ('mirror-backups', 'mirror-backups', false)
on conflict (id) do nothing;

-- 2. Restrict all public access entirely (sanity check, usually default for private buckets)
-- No policies needed for public access

-- 3. Policy: Allow users to SELECT (download/list) their own backups
create policy "Users can view their own backups"
on storage.objects for select
using (
  bucket_id = 'mirror-backups' and
  auth.uid() = cast(split_part(name, '/', 2) as uuid) and
  starts_with(name, 'users/')
);

-- 4. Policy: Allow users to INSERT (upload) their own backups
create policy "Users can upload their own backups"
on storage.objects for insert
with check (
  bucket_id = 'mirror-backups' and
  auth.uid() = cast(split_part(name, '/', 2) as uuid) and
  starts_with(name, 'users/')
);

-- 5. Policy: Allow users to UPDATE their own backups (if they overwrite a file)
create policy "Users can update their own backups"
on storage.objects for update
using (
  bucket_id = 'mirror-backups' and
  auth.uid() = cast(split_part(name, '/', 2) as uuid) and
  starts_with(name, 'users/')
);

-- 6. Policy: Allow users to DELETE their own backups
create policy "Users can delete their own backups"
on storage.objects for delete
using (
  bucket_id = 'mirror-backups' and
  auth.uid() = cast(split_part(name, '/', 2) as uuid) and
  starts_with(name, 'users/')
);
