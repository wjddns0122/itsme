-- Fixes from the Supabase advisors after init_schema (FL-002). docs/04-architecture.md §5-1.
-- 1) is_facility_member() is SECURITY DEFINER. In the public schema the Data API exposes it as
--    /rest/v1/rpc/is_facility_member to anon and authenticated. Move it to a schema the API does not expose.
-- 2) Policies call auth.uid() through (select ...) so Postgres evaluates it once per query, not per row.
-- 3) Index foreign keys that RLS filters on or that cascade from auth.users.

-- ---------------------------------------------------------------- private helper
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_facility_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.facility_members m
    where m.facility_id = fid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_facility_member(uuid) from public, anon;
grant execute on function private.is_facility_member(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- policies
drop policy fac_select on public.facilities;
create policy fac_select on public.facilities for select to authenticated
  using (private.is_facility_member(id));

drop policy fac_update on public.facilities;
create policy fac_update on public.facilities for update to authenticated using (
  exists (
    select 1 from public.facility_members m
    where m.facility_id = facilities.id and m.user_id = (select auth.uid()) and m.role = 'owner'
  )
);

drop policy mem_select on public.facility_members;
create policy mem_select on public.facility_members for select to authenticated
  using (user_id = (select auth.uid()));

drop policy items_all on public.found_items;
create policy items_all on public.found_items for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));

drop policy reports_all on public.lost_reports;
create policy reports_all on public.lost_reports for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));

drop policy cand_all on public.match_candidates;
create policy cand_all on public.match_candidates for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));

drop policy inq_all on public.inquiries;
create policy inq_all on public.inquiries for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));

drop policy events_sel on public.item_events;
create policy events_sel on public.item_events for select to authenticated
  using (private.is_facility_member(facility_id));

drop policy events_ins on public.item_events;
create policy events_ins on public.item_events for insert to authenticated
  with check (private.is_facility_member(facility_id));

drop function public.is_facility_member(uuid);

-- ---------------------------------------------------------------- foreign key indexes
create index match_candidates_facility_idx on public.match_candidates (facility_id, status);
create index item_events_facility_idx on public.item_events (facility_id, created_at desc);
create index found_items_created_by_idx on public.found_items (created_by);
create index lost_reports_created_by_idx on public.lost_reports (created_by);
create index match_candidates_reviewed_by_idx on public.match_candidates (reviewed_by);
create index inquiries_handled_by_idx on public.inquiries (handled_by);
create index item_events_actor_idx on public.item_events (actor);
