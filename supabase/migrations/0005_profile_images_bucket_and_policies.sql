-- Ensure the profile-images bucket exists and is public
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update
set public = excluded.public;

-- Public read access to profile images
create policy if not exists "Public can view profile images"
on storage.objects
for select
to public
using (bucket_id = 'profile-images');

-- Authenticated users can upload profile images into their own folder:
-- profiles/{auth.uid()}/...
create policy if not exists "Users can upload own profile images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = 'profiles'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Authenticated users can update their own profile images
create policy if not exists "Users can update own profile images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = 'profiles'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = 'profiles'
  and (storage.foldername(name))[2] = auth.uid()::text
);
