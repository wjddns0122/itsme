# 04. 시스템 구조

> 이 문서의 SQL은 첫 마이그레이션 초안이다. 실제 적용은 `supabase/migrations/`의 파일이 기준이며, 바꾸면 이 문서도 고친다.

---

## 1. 시스템 구성

```mermaid
flowchart LR
    subgraph Client["브라우저"]
        P["분실자 화면 (public)"]
        A["관리자 화면 (admin)"]
    end
    subgraph Vercel["Vercel: Next.js 한 앱"]
        SA["Server Actions"]
        BG["after(): 백그라운드 작업"]
        RH["Route Handlers: QR, 크론"]
    end
    subgraph Supabase
        AUTH["Auth"]
        DB[("Postgres")]
        ST[("Storage: 사진")]
    end
    CL["Gemini API: 사진 분석, 문장 정리, 유사도 판정, 소유권 비교"]
    RS["Resend: 이메일"]

    P --> SA
    A --> SA
    A --> AUTH
    SA --> DB
    SA --> ST
    SA --> CL
    SA --> BG
    BG --> CL
    BG --> DB
    BG --> RS
    RH --> DB
```

원칙
- **한 앱, 두 화면 묶음.** `(public)`과 `admin` route group. 별도 백엔드 서버 없음.
- **서버만 DB에 쓴다.** 분실자 화면은 Server Action을 거쳐서만 데이터에 접근한다.
- **느린 일은 응답 뒤로.** 신고 정규화·후보 추리기·AI 유사도 판정·이메일은 `after()`로 응답 후에 실행한다. 사진 분석만 예외 (관리자가 결과를 기다려야 함).

## 2. 기술 선택 이유

| 선택 | 이유 | 버린 대안 |
|---|---|---|
| Next.js 한 앱 | 1인 개발, 배포·인증 공유, Server Action으로 API 코드 최소화 | 분실자용·관리자용 앱 분리 |
| Supabase | DB·인증·파일 저장을 한 곳에서 (Stage 2에 pgvector로 벡터 검색 추가). 무료 요금제 | Firebase (벡터 검색 약함), 직접 구축 |
| SQL 후보 추리기 + pg_trgm (MVP) | 매칭은 후보를 SQL로 줄인 뒤 AI가 판정하므로 벡터 DB가 필요 없다. 관리자 검색은 글자 유사도(pg_trgm). 의미 검색은 Stage 2에서 pgvector | 처음부터 벡터 DB |
| 모델 학습 없음 | 사진 → 구조화 텍스트 → 파운데이션 모델(Gemini)이 후보와 직접 비교. MVP 규모에서 충분하고 판정 이유를 설명할 수 있다 | 자체 모델 학습, 처음부터 임베딩 |
| Gemini API | 사진 분석(VLM), 텍스트, 임베딩(Stage 2)을 한 제공자로. 무료 등급으로 개발을 시작할 수 있다 | Claude + 별도 임베딩 제공자 |
| `after()` | 큐 없이 백그라운드 처리. MVP 규모에 충분 | 작업 큐 (Inngest, QStash) — Phase 1에서 재검토 |

## 3. 환경변수 (`.env.example`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # 새 프로젝트면 publishable key
SUPABASE_SERVICE_ROLE_KEY=            # 서버 전용. 브라우저 코드에서 절대 import 금지

# AI
GEMINI_API_KEY=                       # Google AI Studio
GEMINI_TIER=free                      # free: 팀 테스트 데이터만 / paid: 실제 사용자 데이터 가능 (ADR-025)
VISION_MODEL=gemini-4-hydrogen
LLM_MODEL=gemini-4-hydrogen
# Stage 2 (임베딩 검색, ADR-023)
# EMBEDDING_MODEL=gemini-embedding-2
# EMBEDDING_DIM=768

# 매칭
MATCH_SAVE_THRESHOLD=0.45
MATCH_NOTIFY_THRESHOLD=0.70
COVERAGE_MIN_NOTIFY=0.65
AI_JUDGE_BATCH=20
AI_JUDGE_MAX_CANDIDATES=60

# 이메일
RESEND_API_KEY=
EMAIL_FROM=

# 앱
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. 데이터베이스

### 4-1. 관계도

```mermaid
erDiagram
    facilities ||--o{ facility_members : has
    facilities ||--o{ found_items : stores
    facilities ||--o{ lost_reports : receives
    found_items ||--o{ match_candidates : in
    lost_reports ||--o{ match_candidates : in
    found_items ||--o{ item_events : logs
    lost_reports ||--o{ item_events : logs
    facilities ||--o{ inquiries : logs
    lost_reports ||--o{ inquiries : about
```

### 4-2. 스키마 (실제 파일: `supabase/migrations/20261125061818_init_schema.sql`)

아래는 읽기용 요약이다. 함수 실행 권한, `updated_at` 트리거, `mark_returned` 함수, CHECK 제약은 마이그레이션 파일이 기준이다.

```sql
-- 확장
create extension if not exists pg_trgm with schema extensions;   -- 관리자 키워드 검색. pgvector는 Stage 2 (ADR-023)

-- enum: docs/02-user-flows.md §9 와 같아야 한다
create type facility_type    as enum ('school','ski_resort','hotel','festival','cafe','other');
create type member_role      as enum ('owner','staff');
create type found_status     as enum ('stored','claimed','returned','transferred','disposed');
create type report_status    as enum ('open','claimed','resolved','closed');
create type candidate_status as enum ('suggested','claimed','needs_proof','approved','rejected','dismissed');
create type ai_status        as enum ('pending','done','failed','skipped');
create type inquiry_channel  as enum ('phone','visit','message','other');

-- 시설
create table facilities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,            -- QR 주소 /f/{slug}
  type           facility_type not null default 'other',
  region         text,                            -- 시설 검색용 지역 ('평창군', '서울 노원구')
  address        text,
  homepage_url   text,
  intro          text,                            -- 시설 페이지 소개 한 줄
  is_listed      boolean not null default false,  -- 잇츠미 시설 검색·검색엔진 노출 동의 (Q19)
  areas          text[] not null default '{}',    -- 구역 목록
  contact_phone  text,
  hours          text,                            -- 운영 시간 안내
  desk_location  text,                            -- 맡기는 곳 안내 (P-06)
  pickup_guide   text,                            -- 수령 안내 문구 (승인 시 표시)
  transfer_days  int  not null default 30,        -- 보관 기한. 인터뷰: 학교 1~6주, 스키장 1년 → 스키장은 365로 생성. 법정 기한 확인 필요 (Q2, ADR-018)
  created_at     timestamptz not null default now()
);

create index facilities_search_trgm_idx on facilities
  using gin ((name || ' ' || coalesce(region, '') || ' ' || coalesce(address, '')) gin_trgm_ops);

create table facility_members (
  facility_id uuid not null references facilities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'staff',
  primary key (facility_id, user_id)
);

-- 습득물
create table found_items (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references facilities(id) on delete cascade,
  status              found_status not null default 'stored',

  -- 물품 정보 (AI가 채우고 관리자가 확인)
  category            text not null,               -- 05-ai-matching.md §2 분류 코드
  subcategory         text,
  colors              text[] not null default '{}',
  brand               text,
  material            text,
  features            text[] not null default '{}', -- 공개 가능한 특징
  public_summary      text not null,                -- 분실자에게 보이는 설명
  private_features    text[] not null default '{}', -- 비공개 식별 특징 (소유권 확인용)
  is_sensitive        boolean not null default false,
  review_needed       boolean not null default false, -- 빠른 등록에서 AI 확신도 낮음·민감 물품 → 확인 필요
  search_text         text,                         -- AI 유사도 판정·키워드 검색 입력 (코드에서 생성)

  -- 습득·보관
  photo_paths         text[] not null default '{}',
  found_at            timestamptz not null,
  found_area          text,
  storage_location    text,
  transfer_due_at     timestamptz,                  -- found_at + transfer_days

  -- AI 기록
  ai_status           ai_status not null default 'pending',
  ai_confidence       numeric(3,2),
  ai_model            text,
  ai_latency_ms       int,
  ai_raw              jsonb,                        -- 원본 응답 + usage (평가·디버깅)

  -- 반환 기록
  returned_at         timestamptz,
  returned_to_name    text,
  return_method       text,                         -- id_check | qa | unlock | serial | receipt | other
  return_note         text,

  -- 지표
  register_started_at timestamptz,                  -- 등록 화면 진입 시각

  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index found_items_facility_idx on found_items (facility_id, status, found_at desc);
create index found_items_search_trgm_idx on found_items using gin (search_text gin_trgm_ops);

-- 분실 신고
create table lost_reports (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references facilities(id) on delete cascade,
  status            report_status not null default 'open',

  description       text not null,                 -- 분실자 원문
  secret_detail     text,                          -- 나만 아는 특징 (관리자만 봄)
  user_category     text,                          -- 분실자가 고른 분류 (선택)
  language          text not null default 'ko',

  -- AI 정규화 결과
  category          text,
  subcategory       text,
  colors            text[] not null default '{}',
  brand             text,
  features          text[] not null default '{}',
  search_text       text,
  ai_status         ai_status not null default 'pending',
  ai_confidence     numeric(3,2),
  ai_raw            jsonb,

  -- 언제·어디서 (날짜는 한국 시간 기준)
  lost_from         date not null,
  lost_to           date not null,
  lost_area         text,                          -- null = 잘 모르겠어요
  lost_time_of_day  text,                          -- morning | lunch | afternoon | evening | null(모름)
  is_rental         boolean not null default false, -- 빌린 물건 (렌탈 장비)
  report_photo_paths text[] not null default '{}',  -- 분실자가 올린 물건이 나온 사진 (보조 근거, 종료 30일 후 삭제)

  -- 연락처 (LLM에 보내지 않음, 종료 30일 후 삭제)
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  contact_key       text,                          -- 같은 분 묶기: 전화번호 숫자만 또는 소문자 이메일 (F9-1). 분실자 응답에 절대 포함 금지
  consent_at        timestamptz not null,

  access_token      text not null unique,          -- 앱에서 생성: randomBytes(24) base64url
  created_via       text not null default 'web',   -- web(분실자 직접, 진입 경로 무관) | admin(대리 접수)
  created_by        uuid references auth.users(id),
  report_started_at timestamptz,                   -- 신고 화면 진입 시각
  closed_at         timestamptz,
  created_at        timestamptz not null default now(),

  constraint lost_range_chk check (lost_from <= lost_to),
  constraint contact_chk    check (contact_email is not null or contact_phone is not null)
);
create index lost_reports_facility_idx on lost_reports (facility_id, status, created_at desc);
create index lost_reports_contact_idx on lost_reports (facility_id, contact_key) where contact_key is not null;

-- 매칭 후보 (+ 소유권 확인 요청)
create table match_candidates (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references facilities(id) on delete cascade,  -- RLS 단순화용
  lost_report_id    uuid not null references lost_reports(id) on delete cascade,
  found_item_id     uuid not null references found_items(id) on delete cascade,
  score             numeric(5,4) not null,             -- 비교한 항목만으로 낸 일치도
  coverage          numeric(4,3) not null default 1,   -- 정보 충족도: 비교에 쓴 신호의 가중치 합 (05 §5)
  breakdown         jsonb not null,     -- {ai, matched[], conflicts[], category, color, brand, place, date, known[], tie?, dismiss_reason?} 관리자 전용
  status            candidate_status not null default 'suggested',

  claim_answers     jsonb,              -- [{question_id, question, answer}] 분류별 확인 질문 답변
  claim_photo_path  text,
  claim_attempt     int not null default 0,  -- 같은 신고·습득물 쌍의 요청 횟수 (최대 2)
  ai_verdict        jsonb,              -- AI 답변 비교 결과 (05-ai-matching.md §9-2). 관리자 전용
  proof_request     text,               -- 관리자가 요청한 추가 증빙 (분실자에게 보임)
  proof_reply       text,
  proof_photo_path  text,
  claimed_at        timestamptz,
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  review_note       text,               -- 내부 메모 (분실자에게 안 보임)
  pickup_message    text,               -- 승인 시 분실자에게 보낼 수령 안내

  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (lost_report_id, found_item_id)
);
-- 한 신고에서 진행 중인 확인 요청은 1개만
create unique index one_active_claim_per_report
  on match_candidates (lost_report_id) where status = 'claimed';

-- 문의 기록 (반복 문의 줄이기, F9-2)
create table inquiries (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references facilities(id) on delete cascade,
  lost_report_id  uuid references lost_reports(id) on delete set null,
  channel         inquiry_channel not null default 'phone',
  contact_key     text,              -- 신고를 연결하지 않았을 때 같은 분을 묶는 키
  note            text,
  handled_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index inquiries_facility_idx on inquiries (facility_id, created_at desc);
create index inquiries_report_idx on inquiries (lost_report_id);
create index inquiries_contact_idx on inquiries (facility_id, contact_key) where contact_key is not null;

-- 처리 이력 (감사 로그)
create table item_events (
  id              bigint generated always as identity primary key,
  facility_id     uuid not null references facilities(id) on delete cascade,
  found_item_id   uuid references found_items(id) on delete cascade,
  lost_report_id  uuid references lost_reports(id) on delete cascade,
  actor           uuid references auth.users(id),   -- null = 분실자 또는 시스템
  type            text not null,
  -- registered | ai_extracted | edited | matched | notified | claimed
  -- | approved | rejected | proof_requested | proof_submitted | held
  -- | returned | transferred | disposed | report_created | report_closed | inquiry_logged
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index item_events_item_idx on item_events (found_item_id, created_at);
```

### 4-3. 매칭·검색 함수

날짜 비교는 모두 한국 시간(`Asia/Seoul`) 기준이다.

```sql
-- 신고 → 습득물 후보 추리기 (AI 판정 전, 최대 p_limit개)
create or replace function candidate_items_for_report(p_report_id uuid, p_limit int default 60)
returns table (
  found_item_id uuid, found_date date, found_at timestamptz, found_area text,
  category text, colors text[], brand text, ai_confidence numeric, search_text text
)
language sql stable as $$
  select fi.id,
         (fi.found_at at time zone 'Asia/Seoul')::date,
         fi.found_at, fi.found_area, fi.category, fi.colors, fi.brand, fi.ai_confidence, fi.search_text
  from lost_reports lr
  join found_items fi on fi.facility_id = lr.facility_id
  where lr.id = p_report_id
    and fi.status in ('stored','claimed')
    and fi.search_text is not null
    and (fi.found_at at time zone 'Asia/Seoul')::date
        between lr.lost_from - 1 and lr.lost_to + 14
    and (  lr.category is null or lr.category = 'other.other' or fi.category = 'other.other'
        or split_part(fi.category, '.', 1) = split_part(lr.category, '.', 1)
        or coalesce(fi.ai_confidence, 0) < 0.7 or coalesce(lr.ai_confidence, 0) < 0.7)
  order by abs((fi.found_at at time zone 'Asia/Seoul')::date - lr.lost_to), fi.found_at desc
  limit p_limit;
$$;

-- 습득물 → 신고 후보 추리기 (역방향)
create or replace function candidate_reports_for_item(p_item_id uuid, p_limit int default 60)
returns table (
  lost_report_id uuid, lost_from date, lost_to date, lost_area text, lost_time_of_day text,
  category text, colors text[], brand text, ai_confidence numeric, search_text text
)
language sql stable as $$
  select lr.id, lr.lost_from, lr.lost_to, lr.lost_area, lr.lost_time_of_day,
         lr.category, lr.colors, lr.brand, lr.ai_confidence, coalesce(lr.search_text, lr.description)
  from found_items fi
  join lost_reports lr on lr.facility_id = fi.facility_id
  where fi.id = p_item_id
    and lr.status in ('open','claimed')
    and (fi.found_at at time zone 'Asia/Seoul')::date
        between lr.lost_from - 1 and lr.lost_to + 14
    and (  lr.category is null or lr.category = 'other.other' or fi.category = 'other.other'
        or split_part(fi.category, '.', 1) = split_part(lr.category, '.', 1)
        or coalesce(fi.ai_confidence, 0) < 0.7 or coalesce(lr.ai_confidence, 0) < 0.7)
  order by lr.created_at desc
  limit p_limit;
$$;

-- 관리자 키워드 검색 (security invoker → RLS 적용). 의미 검색은 Stage 2
create or replace function search_items(p_query text, p_limit int default 20)
returns setof found_items
language sql stable as $$
  select * from found_items
  where search_text is not null
    and (search_text ilike '%' || p_query || '%' or word_similarity(p_query, search_text) > 0.2)
  order by word_similarity(p_query, search_text) desc, found_at desc
  limit p_limit;
$$;
```

후보가 60개를 넘으면 날짜가 가까운 60개만 AI가 판정한다. 이런 신고가 자주 생기면 Stage 2 임베딩 검색으로 넘어갈 신호다 (`05-ai-matching.md` §10).

시설 검색 (분실자용 P-01). 분실자 화면은 서버(service role)에서 이 함수를 부르고 §9-2 허용 필드만 내려보낸다.

```sql
create or replace function search_facilities(p_query text, p_type facility_type default null, p_limit int default 20)
returns table (slug text, name text, region text, type facility_type)
language sql stable as $$
  select f.slug, f.name, f.region, f.type
  from facilities f
  where f.is_listed
    and (p_type is null or f.type = p_type)
    and (coalesce(p_query, '') = ''
         or (f.name || ' ' || coalesce(f.region, '') || ' ' || coalesce(f.address, '')) ilike '%' || p_query || '%'
         or word_similarity(p_query, f.name || ' ' || coalesce(f.region, '')) > 0.3)
  order by word_similarity(coalesce(p_query, ''), f.name || ' ' || coalesce(f.region, '')) desc, f.name
  limit p_limit;
$$;
```

### 4-4. P1 확장: 여러 시설 한 번에 신고

시설마다 `lost_reports`가 하나씩 생기고 그룹으로 묶인다. 각 시설 관리자는 자기 시설 신고만 본다 (ADR-027). MVP 스키마를 바꾸지 않고 덧붙이는 구조다.

```sql
create table report_groups (
  id            uuid primary key default gen_random_uuid(),
  access_token  text not null unique,   -- 분실자가 모든 신고를 한 번에 보는 링크
  created_at    timestamptz not null default now()
);
alter table lost_reports add column group_id uuid references report_groups(id) on delete set null;
alter table report_groups enable row level security;   -- 정책 없음: 서버만 접근
```

`/r/[token]`은 신고 토큰과 그룹 토큰을 모두 받는다. 매칭은 시설마다 따로 한다.

## 5. 권한 (RLS)과 저장소

### 5-1. RLS

```sql
-- private 스키마는 Data API에 노출되지 않는다. security definer 함수를 public에 두면
-- /rest/v1/rpc/is_facility_member 로 누구나 호출할 수 있어서 여기에 둔다.
create schema private;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_facility_member(fid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.facility_members m
    where m.facility_id = fid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_facility_member(uuid) from public, anon;
grant execute on function private.is_facility_member(uuid) to authenticated, service_role;

alter table facilities       enable row level security;
alter table facility_members enable row level security;
alter table found_items      enable row level security;
alter table lost_reports     enable row level security;
alter table match_candidates enable row level security;
alter table item_events      enable row level security;
alter table inquiries        enable row level security;

-- 모든 정책은 to authenticated. auth.uid()는 (select auth.uid())로 감싸 쿼리당 한 번만 계산한다.
create policy fac_select   on facilities       for select to authenticated using (private.is_facility_member(id));
create policy fac_update   on facilities       for update to authenticated using (
  exists (select 1 from facility_members m
          where m.facility_id = facilities.id and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy mem_select   on facility_members for select to authenticated using (user_id = (select auth.uid()));
create policy items_all    on found_items      for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));
create policy reports_all  on lost_reports     for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));
create policy cand_all     on match_candidates for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));
create policy events_sel   on item_events      for select to authenticated using (private.is_facility_member(facility_id));
create policy events_ins   on item_events      for insert to authenticated with check (private.is_facility_member(facility_id));
create policy inq_all      on inquiries        for all to authenticated
  using (private.is_facility_member(facility_id)) with check (private.is_facility_member(facility_id));
```

실제 SQL: `supabase/migrations/20261125061818_init_schema.sql`, `20261125062436_harden_rls_helpers.sql` (Supabase advisor 지적 반영).

- anon 역할에는 정책이 없다 → 분실자 브라우저는 테이블에 직접 접근할 수 없다.
- 분실자 관련 처리(신고 저장, 토큰 조회, 확인 요청)와 백그라운드 매칭은 **service role**로 서버에서 실행한다. service role은 RLS를 우회하므로, 이 코드는 반드시 `facility_id` 또는 `access_token`으로 범위를 직접 제한한다.
- 관리자 처리는 로그인한 사용자의 Supabase 클라이언트로 실행해 RLS를 그대로 받는다.

### 5-2. Storage

| 버킷 | 공개 | 경로 | 쓰기 | 읽기 |
|---|---|---|---|---|
| `found-items` | 비공개 | `{facility_id}/{uuid}.jpg` | 서버 (Server Action) | 관리자: 10분 만료 서명 URL |
| `claim-photos` | 비공개 | `{facility_id}/{candidate_id}/{uuid}.jpg` | 서버 (service role) | 관리자: 10분 만료 서명 URL |
| `report-photos` | 비공개 | `{facility_id}/{report_id}/{uuid}.jpg` | 서버 (service role) | 관리자: 10분 만료 서명 URL. 종료 30일 후 삭제 |

Storage 정책: 경로 첫 폴더(`(storage.foldername(name))[1]`)가 내 시설인 경우만 허용한다 (`private.is_facility_folder_member(name)`, 문자열로 비교해서 형식이 틀린 경로는 거부). `found-items`는 관리자가 읽기·올리기·지우기, `claim-photos`·`report-photos`는 관리자 읽기만 (쓰기는 서버 service role). 분실자에게는 민감 물품이 아닌 후보 습득물의 첫 사진 1장만, 서버(service role)가 만든 10분 서명 URL로 내려보낸다 (ADR-030). `claim-photos`·`report-photos`와 나머지 습득물 사진은 내려보내지 않는다. 실제 SQL: `supabase/migrations/20261125070430_storage_buckets.sql`, 경로 함수: `src/lib/storage-paths.ts`.

## 6. Server Actions

> 위치: `src/server/actions/*.ts`. 모든 입력은 zod로 검증. 반환 형식 `{ ok: true, data } | { ok: false, error: string }`.

### 6-1. 습득물 (`items.ts`, 관리자)

| 함수 | 입력 | 처리 | 출력 |
|---|---|---|---|
| `analyzePhoto` | `FormData` (사진 1~3장, 각 5MB 이하) | 업로드와 AI 분석을 `Promise.all`로 동시 실행. AI 실패 시 `extraction: null` | `{ photoPaths, extraction, aiLatencyMs }` |
| `createFoundItem` | 양식 값 + `photoPaths` + `extraction` 원본 + `registerStartedAt` | 저장, `transfer_due_at` 계산, 이벤트 `registered`. `after()`로 역방향 매칭 (후보 추리기 → AI 유사도 판정) | `{ id }` |
| `quickCreateFoundItem` | 사진 + 보관 위치 + `registerStartedAt` | 바로 저장(`ai_status = pending`). `after()`로 AI 분석 → 필드 채움 → 확신도 0.6 미만이나 민감 물품이면 `review_needed = true` → 매칭 | `{ id }` |
| `createSensitiveItem` | 분류 + 사진 + 보관 위치 | AI 분석 없이 저장 (`ai_status = skipped`, `is_sensitive = true`). 사진은 외부 AI로 보내지 않는다 | `{ id }` |
| `updateFoundItem` | `id` + 등록과 같은 양식 값 (사진 제외) | `search_text`·`transfer_due_at` 다시 계산. 특징 관련 필드가 바뀌면 `after()`로 재매칭. 이벤트 `edited` (`feature_changed`) | `{ id }` |
| `setFoundItemStatus` | `id`, `transferred` \| `disposed`, 메모 | `stored`·`claimed`에서만. 상태 변경, 열린 후보 `dismissed (item_transferred|item_disposed)`, 다른 확인 요청이 없는 신고는 `open`으로, 이벤트 — 한 트랜잭션 (`set_found_item_status` RPC, security invoker) | `{ id }` |
| `markReturned` | `id`, `candidateId?`, 수령인, 확인 방법, 메모 | 습득물 `returned`, 후보 `approved` 유지, 신고 `resolved`, 같은 습득물의 다른 후보 `dismissed (item_returned)`, 이벤트 `returned` — 한 트랜잭션 (RPC) | `{ id }` |
| `searchItems` | `query` 문자열 | `search_items` RPC (키워드·글자 유사도, pg_trgm) | 습득물 목록 |
| `retryAnalysis` | `id` | `ai_status = failed`인 습득물: 사진 분석을 다시 돌려 `features`·`material`만 채우고(관리자 입력은 그대로) 역방향 매칭. 민감 물품은 제외 | `{ id }` |

### 6-2. 분실 신고 (`reports.ts`)

| 함수 | 사용자 | 처리 | 출력 |
|---|---|---|---|
| `searchFacilities` | 분실자 (비로그인) | 검색어·종류로 `search_facilities` 호출, §9-2 허용 필드만 반환 | 시설 목록 |
| `createLostReport` | 분실자 (비로그인) | slug로 시설 확인, 토큰 생성, `contact_key` 계산, 저장, 이벤트. `after()`로 정규화(사진이 있으면 특징 추출 후 합침) → 후보 추리기 → AI 유사도 판정 → 점수 → 이메일 | `{ token }` |
| `createReportByAdmin` | 관리자 | 로그인 관리자 클라이언트(RLS)로 저장, `created_via = 'admin'`, `created_by`, 이벤트 `report_created`, `after()`로 정규화·매칭 | `{ path: /r/{token} }` |
| `retryReportAnalysis` | 관리자 | A-07 서랍 [다시 분석]: RLS로 신고를 확인한 뒤 `ai_status = failed`인 신고만 `processReport`를 다시 실행 (응답 전에 끝까지 기다림) | `{ id }` |
| `getReportView` | 분실자 | 토큰으로 조회. **공개 필드만** 골라 반환 (§9-2) | 신고 요약 + 후보 공개 정보 |
| `cancelReport` | 분실자 | `closed`, 후보 `dismissed (report_closed)` | `{ ok }` |
| `updateLostReport` | 분실자 | 토큰 확인 후 신고가 `open`일 때만 설명·색상·브랜드·시간대 보완 → `ai_status = pending`, 이벤트 `report_updated`, `after()`로 다시 정규화·매칭 (숨긴 후보는 그대로). 사진 보완은 FL-027(✂️) | P-04로 이동 |

### 6-3. 후보·소유권 확인 (`candidates.ts`)

| 함수 | 사용자 | 처리 |
|---|---|---|
| `dismissCandidate` | 분실자 | 토큰 소유 확인 후 `dismissed (user)` |
| `submitClaim` | 분실자 | 토큰 소유 확인, 진행 중 요청 없음·시도 2회 미만 확인, 분류별 질문 답변(질문 문구와 함께)·사진 저장, 후보 `claimed`, 습득물 `claimed`, 신고 `claimed` — DB 함수 `submit_claim` 한 트랜잭션(service role 전용, 결과 코드 `ok`·`active_exists`·`limit`·`not_available`). `after()`로 AI 답변 비교 → `ai_verdict` 저장 (FL-044 ✂️) |
| `reviewClaim` | 관리자 | DB 함수 `review_claim(candidate, action, message, note)` (security invoker, RLS). `approve`: 후보 `approved`, 수령 안내(필수 증빙 포함) 저장·이메일. `request_proof`: 후보 `needs_proof`, `proof_request` 저장, 분실자 이메일. `hold`: 상태 유지, 내부 메모. `reject`: 후보 `rejected`, 습득물에 다른 `claimed` 후보가 없으면 `stored`, 신고 `open` |
| `submitProof` | 분실자 | 토큰 소유 확인, 후보가 `needs_proof`일 때만 답변·사진 저장 → `claimed`로 복귀 (DB 함수 `submit_proof`), AI 비교 다시 실행 (FL-044) |

### 6-4. Route Handlers

| 경로 | 용도 |
|---|---|
| `GET /api/qr/[slug]` | QR PNG 생성 (`qrcode` 패키지) |
| `GET /api/cron/cleanup` | (P1) 종료 30일 지난 신고의 연락처 삭제. Vercel Cron |

### 6-5. 문의 (`inquiries.ts`, 관리자)

| 함수 | 입력 | 처리 | 출력 |
|---|---|---|---|
| `findReportsByContact` | 전화번호 뒷자리 4개 또는 이메일 | 같은 시설 신고를 연락처로 검색, 같은 `contact_key`끼리 묶어 반환. 구현은 A-07 목록 로더 `listLostReports`의 `contact` 필터(`parseContactSearch`: 숫자 4개는 `contact_key` 끝자리, 전화번호·이메일 전체는 정규화해서 일치)와 `groupReports` | 신고 묶음 목록 |
| `logInquiry` | `channel`, `lostReportId?`, `contact?`, `note?` | 문의 기록 저장 (`handled_by` = 로그인 사용자), 이벤트 `inquiry_logged` | `{ id }` |
| `listInquiries` | `lostReportId` 또는 `contactKey` | 시간순 문의 기록 | 문의 목록 |

`contact_key` 만드는 규칙 (`lib/validation/contact.ts`의 `toContactKey`): 전화번호는 숫자만 남기고 앞의 `82`를 `0`으로, 이메일은 앞뒤 공백을 빼고 소문자로. 단위 테스트 필수.

## 7. 백그라운드 작업

```ts
// 예: createLostReport 안
import { after } from 'next/server';

const report = await insertReport(input);      // service role
after(async () => {
  await processReport(report.id);              // 정규화 → 후보 추리기 → AI 유사도 판정 → 점수 → 알림
});
return { ok: true, data: { token: report.access_token } };
```

- `processReport` / `processItem`은 각 단계 실패 시 `ai_status = 'failed'`로 표시하고 원문으로 계속 진행한다 (`02-user-flows.md` §10).
- 같은 작업이 두 번 돌아도 결과가 같게 만든다: 후보는 `(lost_report_id, found_item_id)` upsert, `claimed` 이후 상태는 덮어쓰지 않는다.
- 해당 경로의 `maxDuration`은 60초로 둔다: `f/[slug]/report/page.tsx`, `admin/(console)/layout.tsx`.
- 구현: `lib/matching/process.ts`(`processReport`, `processItem`), `lib/matching/run.ts`(`matchForReport`, `matchForItem`), `lib/matching/plan.ts`(저장 규칙, 순수 함수). service role로 실행하되 후보 추리기 RPC가 같은 시설로 묶는다.
- 호출 계기: `createLostReport`, `createFoundItem`, `createSensitiveItem`, `updateFoundItem`(분류·색상·브랜드·비공개 특징·습득 일시·구역이 바뀐 경우), `retryAnalysis`.
- AI 호출 실패는 HTTP 상태 코드만 로그에 남긴다 (`http_status`). 응답 본문·프롬프트는 남기지 않는다.
- service role로 쓰는 후보 쿼리에는 모두 `facility_id` 조건을 붙인다. 새 후보를 넣은 직후 신고·습득물이 그사이 닫혔는지 다시 보고, 닫혔으면 방금 넣은 후보를 지운다.
- 운영 배포(`VERCEL_ENV=production`)에서 `GEMINI_TIER`가 `paid`가 아니면 AI 설정을 읽지 않는다 (ADR-025). 그때는 AI 실패와 같은 길(원문 비교, 중립값, 알림 없음)로 간다.
- 카드·신분증 분류(`wallet_card.card`, `wallet_card.id`)는 등록·수정 때 서버가 `is_sensitive = true`로 강제한다. [다시 분석]은 민감 물품에 쓰지 않고, 다시 분석한 결과가 민감 물품이면 특징을 채우지 않고 "확인 필요"로 보낸다.

## 8. 알림 (이메일)

| 계기 | 받는 사람 | 제목 |
|---|---|---|
| 신고 접수 | 분실자 | [잇츠미] 신고했어요 — 신고 확인 링크 |
| 0.70 이상 새 후보 | 분실자 | [잇츠미] 비슷한 물건이 들어왔어요 |
| 소유권 승인 | 분실자 | [잇츠미] 주인 확인이 끝났어요 — 수령 안내 |
| 새 확인 요청 | 시설 관리자 | [잇츠미] 새 확인 요청 1건 (P1) |

- 신고 1건당 후보 알림은 24시간에 최대 3통 (`notified_at`으로 계산).
- 같은 `contact_key`의 여러 신고가 같은 습득물과 매칭되면 알림은 1통만 보낸다.
- 이메일 본문에는 공개 설명만 넣는다. 사진·비공개 특징·점수는 넣지 않는다.
- 구현 (`lib/notify/`): Resend HTTP API를 `fetch`로 부른다 (SDK 없이). 환경변수 `RESEND_API_KEY`, `EMAIL_FROM`, 링크 주소는 `NEXT_PUBLIC_APP_URL`. 키가 없으면 보내지 않고 `email_skipped`만 남긴다. 로그에는 종류와 HTTP 상태만 남기고 주소·본문은 남기지 않는다.
- 계기: `createLostReport`·`createReportByAdmin`의 `after()`(신고 접수), 매칭 결과 `plan.notify`(새 후보), `reviewClaim` 승인의 `after()`(수령 안내). 보낸 뒤 후보 `notified_at`과 이벤트 `notified`를 남긴다. 관리자용 새 확인 요청 메일(P1)은 아직 없다.

## 9. 보안과 개인정보

### 9-1. 체크리스트

- [ ] service role 키는 `lib/supabase/admin.ts`에서만, `server-only`로 보호
- [ ] 분실자 토큰: 24바이트 난수, URL에만 존재. 로그에 남기지 않는다
- [ ] 사진은 비공개 버킷 + 서명 URL (10분)
- [ ] 업로드 검증: 이미지 MIME만, 장당 5MB 이하, 최대 3장
- [ ] 분실자 쓰기 요청에 숨은 입력칸(honeypot) 추가. 요청 수 제한은 P1
- [ ] 소유권 확인 요청 시도 제한: 신고당 동시 1건, 같은 신고·습득물 쌍 2회, 같은 연락처 7일 3건 이상 경고
- [ ] LLM에 연락처 전송 금지. 사진 속 개인정보는 프롬프트로 마스킹 지시
- [ ] Gemini 무료 등급 키(`GEMINI_TIER=free`)로는 팀 테스트 데이터만. 실제 분실자 데이터는 유료 등급 키로만 (ADR-025)
- [ ] 민감 물품 버튼으로 등록한 사진은 외부 AI로 보내지 않는다
- [ ] 분실자가 올린 사진(얼굴이 나올 수 있음)은 비공개 버킷에 두고, 종료 30일 후 삭제
- [ ] 동의 문구에 수집 항목, 목적, 보관 기간 명시
- [ ] 종료 30일 후 연락처와 `contact_key` 삭제 (MVP 수동, P1 크론). 연결된 문의 기록의 `contact_key`도 함께

### 9-2. 분실자에게 내려보내도 되는 필드 (허용 목록)

| 테이블 | 허용 필드 |
|---|---|
| `lost_reports` | `description`, `user_category`(본인이 고른 분류), `lost_from`, `lost_to`, `lost_area`, `lost_time_of_day`, `is_rental`, `status`, `created_at`, `ai_status` |
| `match_candidates` | `id`, `status`, 유사도 라벨(높음/보통 — 점수 숫자 아님), 정보 부족 표시(충족도 숫자 아님), `pickup_message`(승인 시), `proof_request`(추가 증빙 요청 시). **`ai_verdict`, `review_note`는 절대 안 됨** |
| `found_items` | `category`, `subcategory`, `public_summary`, 습득 날짜(일 단위), `found_area`, 대표 사진 1장(`photo_paths[0]`을 서버가 서명한 10분 URL. 경로 자체는 안 됨, ADR-030). **민감 물품이면 `category`만** |
| `facilities` | `slug`, `name`, `region`, `type`, `intro`, `homepage_url`, `contact_phone`, `hours`, `desk_location`, `pickup_guide`, `areas`(신고 양식 구역 칩). `is_listed = false` 시설은 검색 결과에 넣지 않는다 |

이 목록 밖의 필드를 분실자 응답에 넣는 코드는 리뷰에서 막는다. 특히 `contact_key`와 같은 연락처의 다른 신고가 있는지 여부는 절대 넣지 않는다 (F9 개인정보 규칙). `getReportView`에 이 목록을 그대로 코드로 둔다.

## 10. 관측과 지표 수집

| 지표 | 저장 위치 |
|---|---|
| 등록 소요시간 | `found_items.created_at - register_started_at` |
| 신고 소요시간 | `lost_reports.created_at - report_started_at` |
| AI 지연·토큰 사용량 | `found_items.ai_latency_ms`, `ai_raw.usage` / `lost_reports.ai_raw.usage` |
| 매칭 결과 | `match_candidates.breakdown` |
| 처리 흐름 | `item_events` |
| 문의 수, 같은 분 재문의 수 | `inquiries` (날짜별, `contact_key`별) |

서버 로그: AI 호출마다 `{ kind, model, latency_ms, input_tokens, output_tokens, finish_reason }` 한 줄. 연락처·토큰은 로그에 남기지 않는다.

## 11. 배포

- Vercel 프로젝트 1개, `main` 브랜치 자동 배포, PR마다 미리보기 배포.
- Supabase 프로젝트 1개 (MVP). Phase 1에서 개발/운영 분리.
- 시드: `pnpm db:seed -- --project-ref <ref>` (`scripts/seed.mts`, 원격은 대상 프로젝트 ref를 명시해야 실행) — 예시 시설 5곳(스키장 `transfer_days` 365, 학교·리조트·카페·축제 30, 모두 `is_listed`), 시설마다 관리자 1명(`admin.<slug>@example.com`, 비밀번호는 `.env.local`의 `SEED_ADMIN_PASSWORD`), 구역 목록. 다시 실행해도 된다. 이미 있는 시설은 덮어쓰지 않고, 이름이 시드 예시 이름 그대로인 시설에만 관리자를 연결한다. 공개 가입은 끈다 (관리자 계정은 시드·초대로만).
- 리전: Supabase는 서울(`ap-northeast-2`), Vercel 함수 리전도 서울(`icn1`)로 맞춘다.
- 실제 구성 (2026-11-25, FL-006): GitHub 비공개 저장소 `wjddns0122/itsme`, Vercel 프로젝트 `itsme`(Git 연결, `main` push = 운영 배포). 함수 리전은 `vercel.json`의 `regions: ["icn1"]`.
- 환경변수는 `.env.local`에서 값이 화면에 나오지 않게 `vercel env add`로 운영·미리보기에 등록한다 (`.claude/skills/deploy/deploy-config.md` 표). `NEXT_PUBLIC_APP_URL`은 운영 주소로 따로 등록한다. 운영은 `GEMINI_TIER=paid`가 아니면 AI를 쓰지 않는다 (ADR-025, `lib/ai/client.ts`). 해커톤 시연 동안만 `GEMINI_FREE_DEMO_UNTIL`(한국 날짜)까지 무료 키를 허용하고, 그 날이 지나면 따뜻한 서버 인스턴스에서도 바로 다시 막힌다.
