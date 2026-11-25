-- FL-004 Storage: private photo buckets and folder-based access. docs/04-architecture.md §5-2.
-- Paths start with the facility id: found-items/{facility_id}/{uuid}.jpg,
-- claim-photos/{facility_id}/{candidate_id}/{uuid}.jpg, report-photos/{facility_id}/{report_id}/{uuid}.jpg.
-- People who lost something never get a photo URL. Their uploads go through the server with the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('found-items', 'found-items', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('claim-photos', 'claim-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- True when the first folder of an object path is a facility the signed-in user belongs to.
-- Compares as text so a malformed path returns false instead of a cast error.
create or replace function private.is_facility_folder_member(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.facility_members m
    where m.user_id = (select auth.uid())
      and m.facility_id::text = (storage.foldername(object_name))[1]
  );
$$;
revoke all on function private.is_facility_folder_member(text) from public, anon;
grant execute on function private.is_facility_folder_member(text) to authenticated, service_role;

-- found-items: admins upload, read (signed URLs) and delete photos of their own facility.
create policy found_items_select on storage.objects for select to authenticated
  using (bucket_id = 'found-items' and private.is_facility_folder_member(name));
create policy found_items_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'found-items' and private.is_facility_folder_member(name));
create policy found_items_delete on storage.objects for delete to authenticated
  using (bucket_id = 'found-items' and private.is_facility_folder_member(name));

-- claim-photos, report-photos: written by the server (service role), read by the facility's admins.
create policy claim_report_photos_select on storage.objects for select to authenticated
  using (bucket_id in ('claim-photos', 'report-photos') and private.is_facility_folder_member(name));
