-- 잇츠미 실증 지표 (docs/01-prd.md §7, docs/04-architecture.md §10). FL-082.
-- Read-only. Run in the Supabase SQL editor or psql. Change :facility_slug and :since below.
-- Times are Asia/Seoul. Contact details are never selected: only counts per contact_key.

-- 0. Parameters
with params as (
  select 'pc-ski'::text as facility_slug,          -- :facility_slug
         (now() - interval '30 days') as since      -- :since
), fac as (
  select f.id from facilities f join params p on f.slug = p.facility_slug
)

-- 1. 습득물 등록 소요시간 (목표: 중앙값 15초 이내)
select 'register_seconds' as metric,
       count(*) as n,
       round(percentile_cont(0.5) within group (order by extract(epoch from fi.created_at - fi.register_started_at))::numeric, 1) as median,
       round(percentile_cont(0.9) within group (order by extract(epoch from fi.created_at - fi.register_started_at))::numeric, 1) as p90
from found_items fi, fac, params
where fi.facility_id = fac.id
  and fi.register_started_at is not null
  and fi.created_at >= params.since
  -- a form left open for hours is not a measurement
  and fi.created_at - fi.register_started_at between interval '0 seconds' and interval '30 minutes'

union all

-- 2. 분실 신고 소요시간 (목표: 중앙값 60초 이내). Web reports only; admin-entered ones are timed separately.
select 'report_seconds_web',
       count(*),
       round(percentile_cont(0.5) within group (order by extract(epoch from lr.created_at - lr.report_started_at))::numeric, 1),
       round(percentile_cont(0.9) within group (order by extract(epoch from lr.created_at - lr.report_started_at))::numeric, 1)
from lost_reports lr, fac, params
where lr.facility_id = fac.id
  and lr.created_via = 'web'
  and lr.report_started_at is not null
  and lr.created_at >= params.since
  and lr.created_at - lr.report_started_at between interval '0 seconds' and interval '30 minutes';

-- 3. 하루 문의 수와 같은 분 재문의 수 (docs/01-prd.md §7 반복 문의 수)
--    재문의 = the same contact_key already asked earlier (any day before).
with params as (
  select 'pc-ski'::text as facility_slug, (now() - interval '30 days') as since
), fac as (
  select f.id from facilities f join params p on f.slug = p.facility_slug
), inq as (
  select i.*,
         (i.created_at at time zone 'Asia/Seoul')::date as day,
         row_number() over (partition by i.contact_key order by i.created_at) as nth
  from inquiries i, fac
  where i.facility_id = fac.id
)
select day,
       count(*) as inquiries,
       count(*) filter (where contact_key is not null and nth > 1) as repeat_inquiries,
       count(*) filter (where channel = 'phone') as phone,
       count(*) filter (where channel = 'visit') as visit
from inq, params
where inq.created_at >= params.since
group by day
order by day;

-- 4. AI 지연 (참고): 사진 분석 p50·p95 ms
with params as (
  select 'pc-ski'::text as facility_slug, (now() - interval '30 days') as since
), fac as (
  select f.id from facilities f join params p on f.slug = p.facility_slug
)
select count(*) as n,
       percentile_cont(0.5) within group (order by fi.ai_latency_ms) as p50_ms,
       percentile_cont(0.95) within group (order by fi.ai_latency_ms) as p95_ms
from found_items fi, fac, params
where fi.facility_id = fac.id and fi.ai_latency_ms is not null and fi.created_at >= params.since;
