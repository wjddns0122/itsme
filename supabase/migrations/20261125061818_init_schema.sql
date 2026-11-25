-- 잇츠미 initial schema (FL-002)
-- Source of truth for intent: docs/04-architecture.md §4, §5-1. Enum values must match docs/02-user-flows.md §9.
-- Stage 1 matching: SQL prefilter + Gemini similarity (no pgvector). pgvector arrives in Stage 2 (ADR-023).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- enums
create type facility_type    as enum ('school', 'ski_resort', 'hotel', 'festival', 'cafe', 'other');
create type member_role      as enum ('owner', 'staff');
create type found_status     as enum ('stored', 'claimed', 'returned', 'transferred', 'disposed');
create type report_status    as enum ('open', 'claimed', 'resolved', 'closed');
create type candidate_status as enum ('suggested', 'claimed', 'needs_proof', 'approved', 'rejected', 'dismissed');
create type ai_status        as enum ('pending', 'done', 'failed', 'skipped');
create type inquiry_channel  as enum ('phone', 'visit', 'message', 'other');

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- facilities
create table facilities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,                 -- public page /f/{slug}
  type           facility_type not null default 'other',
  region         text,                                 -- for facility search ('평창군', '서울 노원구')
  address        text,
  homepage_url   text,
  intro          text,
  is_listed      boolean not null default false,       -- shown in 잇츠미 search and search engines (Q19)
  areas          text[] not null default '{}',
  contact_phone  text,
  hours          text,
  desk_location  text,
  pickup_guide   text,
  transfer_days  int not null default 30 check (transfer_days > 0),  -- ski resorts are created with 365 (ADR-018)
  created_at     timestamptz not null default now()
);
create index facilities_search_trgm_idx on facilities
  using gin ((name || ' ' || coalesce(region, '') || ' ' || coalesce(address, '')) extensions.gin_trgm_ops);

create table facility_members (
  facility_id uuid not null references facilities (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        member_role not null default 'staff',
  primary key (facility_id, user_id)
);
create index facility_members_user_idx on facility_members (user_id);

-- ---------------------------------------------------------------- found items
create table found_items (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references facilities (id) on delete cascade,
  status              found_status not null default 'stored',

  category            text not null,                  -- docs/05-ai-matching.md §2-1
  subcategory         text,
  colors              text[] not null default '{}',
  brand               text,
  material            text,
  features            text[] not null default '{}',   -- public features
  public_summary      text not null,                   -- shown to people who lost something
  private_features    text[] not null default '{}',   -- admin only, used for ownership checks
  is_sensitive        boolean not null default false,
  review_needed       boolean not null default false,  -- quick capture: low AI confidence or sensitive
  search_text         text,                            -- built by buildSearchText()

  photo_paths         text[] not null default '{}',
  found_at            timestamptz not null,
  found_area          text,
  storage_location    text,
  transfer_due_at     timestamptz,

  ai_status           ai_status not null default 'pending',
  ai_confidence       numeric(3, 2) check (ai_confidence between 0 and 1),
  ai_model            text,
  ai_latency_ms       int,
  ai_raw              jsonb,

  returned_at         timestamptz,
  returned_to_name    text,
  return_method       text check (return_method in ('id_check', 'qa', 'unlock', 'serial', 'receipt', 'other')),
  return_note         text,

  register_started_at timestamptz,

  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index found_items_facility_idx on found_items (facility_id, status, found_at desc);
create index found_items_search_trgm_idx on found_items using gin (search_text extensions.gin_trgm_ops);
create trigger found_items_updated_at before update on found_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- lost reports
create table lost_reports (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references facilities (id) on delete cascade,
  status             report_status not null default 'open',

  description        text not null,
  secret_detail      text,
  user_category      text,
  language           text not null default 'ko',

  category           text,
  subcategory        text,
  colors             text[] not null default '{}',
  brand              text,
  features           text[] not null default '{}',
  search_text        text,
  ai_status          ai_status not null default 'pending',
  ai_confidence      numeric(3, 2) check (ai_confidence between 0 and 1),
  ai_raw             jsonb,

  lost_from          date not null,                    -- dates are Asia/Seoul
  lost_to            date not null,
  lost_area          text,                             -- null = "잘 모르겠어요"
  lost_time_of_day   text check (lost_time_of_day in ('morning', 'lunch', 'afternoon', 'evening')),
  is_rental          boolean not null default false,
  report_photo_paths text[] not null default '{}',

  -- contact data: never sent to the LLM, deleted 30 days after closing
  contact_name       text,
  contact_email      text,
  contact_phone      text,
  contact_key        text,                             -- never returned to the public (F9-1)
  consent_at         timestamptz not null,

  access_token       text not null unique,             -- randomBytes(24) base64url, generated in the app
  created_via        text not null default 'web' check (created_via in ('web', 'admin')),
  created_by         uuid references auth.users (id),
  report_started_at  timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),

  constraint lost_range_chk check (lost_from <= lost_to),
  constraint contact_chk check (contact_email is not null or contact_phone is not null)
);
create index lost_reports_facility_idx on lost_reports (facility_id, status, created_at desc);
create index lost_reports_contact_idx on lost_reports (facility_id, contact_key) where contact_key is not null;

-- ---------------------------------------------------------------- match candidates (+ ownership claims)
create table match_candidates (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references facilities (id) on delete cascade,
  lost_report_id    uuid not null references lost_reports (id) on delete cascade,
  found_item_id     uuid not null references found_items (id) on delete cascade,
  score             numeric(5, 4) not null check (score between 0 and 1),
  coverage          numeric(4, 3) not null default 1 check (coverage between 0 and 1),
  breakdown         jsonb not null,                    -- admin only
  status            candidate_status not null default 'suggested',

  claim_answers     jsonb,
  claim_photo_path  text,
  claim_attempt     int not null default 0 check (claim_attempt between 0 and 2),
  ai_verdict        jsonb,                             -- admin only
  proof_request     text,
  proof_reply       text,
  proof_photo_path  text,
  claimed_at        timestamptz,
  reviewed_by       uuid references auth.users (id),
  reviewed_at       timestamptz,
  review_note       text,                              -- admin only
  pickup_message    text,

  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (lost_report_id, found_item_id)
);
create index match_candidates_item_idx on match_candidates (found_item_id, status);
create unique index one_active_claim_per_report on match_candidates (lost_report_id) where status = 'claimed';
create trigger match_candidates_updated_at before update on match_candidates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- inquiries (F9-2)
create table inquiries (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references facilities (id) on delete cascade,
  lost_report_id  uuid references lost_reports (id) on delete set null,
  channel         inquiry_channel not null default 'phone',
  contact_key     text,
  note            text,
  handled_by      uuid references auth.users (id),
  created_at      timestamptz not null default now()
);
create index inquiries_facility_idx on inquiries (facility_id, created_at desc);
create index inquiries_report_idx on inquiries (lost_report_id);
create index inquiries_contact_idx on inquiries (facility_id, contact_key) where contact_key is not null;

-- ---------------------------------------------------------------- audit log
create table item_events (
  id              bigint generated always as identity primary key,
  facility_id     uuid not null references facilities (id) on delete cascade,
  found_item_id   uuid references found_items (id) on delete cascade,
  lost_report_id  uuid references lost_reports (id) on delete cascade,
  actor           uuid references auth.users (id),     -- null = person who lost the item, or the system
  type            text not null,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index item_events_item_idx on item_events (found_item_id, created_at);
create index item_events_report_idx on item_events (lost_report_id, created_at);

-- ---------------------------------------------------------------- RLS
create or replace function is_facility_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from facility_members m
    where m.facility_id = fid and m.user_id = auth.uid()
  );
$$;

alter table facilities       enable row level security;
alter table facility_members enable row level security;
alter table found_items      enable row level security;
alter table lost_reports     enable row level security;
alter table match_candidates enable row level security;
alter table inquiries        enable row level security;
alter table item_events      enable row level security;

-- No policies for anon: the public site reaches data only through server code (ADR-004).
create policy fac_select on facilities for select to authenticated using (is_facility_member(id));
create policy fac_update on facilities for update to authenticated using (
  exists (
    select 1 from facility_members m
    where m.facility_id = facilities.id and m.user_id = auth.uid() and m.role = 'owner'
  )
);
create policy mem_select on facility_members for select to authenticated using (user_id = auth.uid());
create policy items_all on found_items for all to authenticated
  using (is_facility_member(facility_id)) with check (is_facility_member(facility_id));
create policy reports_all on lost_reports for all to authenticated
  using (is_facility_member(facility_id)) with check (is_facility_member(facility_id));
create policy cand_all on match_candidates for all to authenticated
  using (is_facility_member(facility_id)) with check (is_facility_member(facility_id));
create policy inq_all on inquiries for all to authenticated
  using (is_facility_member(facility_id)) with check (is_facility_member(facility_id));
create policy events_sel on item_events for select to authenticated using (is_facility_member(facility_id));
create policy events_ins on item_events for insert to authenticated with check (is_facility_member(facility_id));

-- ---------------------------------------------------------------- matching prefilter (Stage 1)
-- Lost report -> found item candidates before Gemini similarity judging (docs/05-ai-matching.md §5-4).
create or replace function candidate_items_for_report(p_report_id uuid, p_limit int default 60)
returns table (
  found_item_id uuid, found_date date, found_at timestamptz, found_area text,
  category text, colors text[], brand text, ai_confidence numeric, search_text text
)
language sql
stable
set search_path = public, extensions
as $$
  select fi.id,
         (fi.found_at at time zone 'Asia/Seoul')::date,
         fi.found_at, fi.found_area, fi.category, fi.colors, fi.brand, fi.ai_confidence, fi.search_text
  from lost_reports lr
  join found_items fi on fi.facility_id = lr.facility_id
  where lr.id = p_report_id
    and fi.status in ('stored', 'claimed')
    and fi.search_text is not null
    and (fi.found_at at time zone 'Asia/Seoul')::date between lr.lost_from - 1 and lr.lost_to + 14
    and (   lr.category is null or lr.category = 'other.other' or fi.category = 'other.other'
         or split_part(fi.category, '.', 1) = split_part(lr.category, '.', 1)
         or coalesce(fi.ai_confidence, 0) < 0.7 or coalesce(lr.ai_confidence, 0) < 0.7)
  order by abs((fi.found_at at time zone 'Asia/Seoul')::date - lr.lost_to), fi.found_at desc
  limit p_limit;
$$;

-- Found item -> open lost report candidates (reverse direction).
create or replace function candidate_reports_for_item(p_item_id uuid, p_limit int default 60)
returns table (
  lost_report_id uuid, lost_from date, lost_to date, lost_area text, lost_time_of_day text,
  category text, colors text[], brand text, ai_confidence numeric, search_text text
)
language sql
stable
set search_path = public, extensions
as $$
  select lr.id, lr.lost_from, lr.lost_to, lr.lost_area, lr.lost_time_of_day,
         lr.category, lr.colors, lr.brand, lr.ai_confidence, coalesce(lr.search_text, lr.description)
  from found_items fi
  join lost_reports lr on lr.facility_id = fi.facility_id
  where fi.id = p_item_id
    and lr.status in ('open', 'claimed')
    and (fi.found_at at time zone 'Asia/Seoul')::date between lr.lost_from - 1 and lr.lost_to + 14
    and (   lr.category is null or lr.category = 'other.other' or fi.category = 'other.other'
         or split_part(fi.category, '.', 1) = split_part(lr.category, '.', 1)
         or coalesce(fi.ai_confidence, 0) < 0.7 or coalesce(lr.ai_confidence, 0) < 0.7)
  order by lr.created_at desc
  limit p_limit;
$$;

-- Admin keyword search. Security invoker, so RLS limits results to the admin's facility.
create or replace function search_items(p_query text, p_limit int default 20)
returns setof found_items
language sql
stable
set search_path = public, extensions
as $$
  select * from found_items
  where search_text is not null
    and (search_text ilike '%' || p_query || '%' or word_similarity(p_query, search_text) > 0.2)
  order by word_similarity(p_query, search_text) desc, found_at desc
  limit p_limit;
$$;

-- Public facility search (P-01). Called by server code with the service role; the server
-- returns only the allowlisted fields (docs/04-architecture.md §9-2).
create or replace function search_facilities(p_query text, p_type facility_type default null, p_limit int default 20)
returns table (slug text, name text, region text, type facility_type)
language sql
stable
set search_path = public, extensions
as $$
  select f.slug, f.name, f.region, f.type
  from facilities f
  where f.is_listed
    and (p_type is null or f.type = p_type)
    and (   coalesce(p_query, '') = ''
         or (f.name || ' ' || coalesce(f.region, '') || ' ' || coalesce(f.address, '')) ilike '%' || p_query || '%'
         or word_similarity(p_query, f.name || ' ' || coalesce(f.region, '')) > 0.3)
  order by word_similarity(coalesce(p_query, ''), f.name || ' ' || coalesce(f.region, '')) desc, f.name
  limit p_limit;
$$;

-- ---------------------------------------------------------------- return in one transaction (FL-042)
-- Marks the item returned, resolves the linked report, and dismisses the item's other candidates.
-- Security invoker: the caller's RLS applies, so admins can only return items of their own facility.
create or replace function mark_returned(
  p_item_id uuid,
  p_candidate_id uuid,
  p_recipient text,
  p_method text,
  p_note text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item found_items%rowtype;
  v_report_id uuid;
begin
  if coalesce(trim(p_recipient), '') = '' then
    raise exception 'recipient name is required';
  end if;

  select * into v_item from found_items where id = p_item_id for update;
  if not found then
    raise exception 'found item % not found', p_item_id;
  end if;
  if v_item.status not in ('stored', 'claimed') then
    raise exception 'found item % cannot be returned from status %', p_item_id, v_item.status;
  end if;

  if p_candidate_id is not null then
    select lost_report_id into v_report_id
    from match_candidates
    where id = p_candidate_id and found_item_id = p_item_id and status = 'approved';
    if v_report_id is null then
      raise exception 'candidate % is not an approved candidate of item %', p_candidate_id, p_item_id;
    end if;
    update lost_reports set status = 'resolved', closed_at = now() where id = v_report_id;
  end if;

  update found_items
  set status = 'returned', returned_at = now(), returned_to_name = trim(p_recipient),
      return_method = p_method, return_note = p_note
  where id = p_item_id;

  update match_candidates
  set status = 'dismissed',
      breakdown = breakdown || jsonb_build_object('dismiss_reason', 'item_returned')
  where found_item_id = p_item_id
    and (p_candidate_id is null or id <> p_candidate_id)
    and status in ('suggested', 'claimed', 'needs_proof');

  insert into item_events (facility_id, found_item_id, lost_report_id, actor, type, payload)
  values (v_item.facility_id, p_item_id, v_report_id, auth.uid(), 'returned',
          jsonb_build_object('method', p_method, 'candidate_id', p_candidate_id));
end;
$$;

-- ---------------------------------------------------------------- function privileges
-- Internal functions run only from server code with the service role.
revoke all on function candidate_items_for_report(uuid, int) from public, anon, authenticated;
revoke all on function candidate_reports_for_item(uuid, int) from public, anon, authenticated;
revoke all on function search_facilities(text, facility_type, int) from public, anon, authenticated;
grant execute on function candidate_items_for_report(uuid, int) to service_role;
grant execute on function candidate_reports_for_item(uuid, int) to service_role;
grant execute on function search_facilities(text, facility_type, int) to service_role;

-- Admin functions: signed-in users only (RLS still applies inside).
revoke all on function search_items(text, int) from public, anon;
revoke all on function mark_returned(uuid, uuid, text, text, text) from public, anon;
grant execute on function search_items(text, int) to authenticated, service_role;
grant execute on function mark_returned(uuid, uuid, text, text, text) to authenticated, service_role;
