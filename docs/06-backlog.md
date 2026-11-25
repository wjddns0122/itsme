# 06. 백로그

> 티켓 하나 = AI 에이전트에게 한 번에 맡기는 단위. 2~3시간 안에 끝나는 크기로 쪼갰다.
> 예상 시간은 AI 도움을 받는 1인 개발 기준 추정이다.
> ✂️ 표시는 `00-plan.md` §5 컷 라인 대상.

## AI에게 맡기는 방법

Claude Code에서 `/ticket FL-011` 처럼 부른다 (`.claude/commands/ticket.md`). 다른 도구를 쓸 때는 아래 틀을 붙여 넣는다.

```text
docs/06-backlog.md 의 {티켓 ID} 를 구현해줘.
1. 티켓의 "참고" 문서를 먼저 읽어.
2. 바꿀 파일과 구현 계획을 5줄 이내로 말하고 시작해.
3. 범위 밖 수정이 필요하면 하지 말고 제안만 해.
4. 끝나면 pnpm typecheck && pnpm lint && pnpm test 를 돌리고,
   수용 기준을 하나씩 [x]/[ ] 로 체크해서 보고해.
```

## 진행 현황

| 에픽 | 티켓 | 일정 |
|---|---|---|
| E0 셋업 | FL-001 ~ FL-006 | Day 1 |
| E1 습득물 등록·관리 | FL-010 ~ FL-016 | Day 1 (FL-011 스파이크), Day 2 오전 |
| E2 분실 신고·반복 문의 | FL-020 ~ FL-028 | Day 2 오후, Day 3 오전 |
| E3 매칭 | FL-030 ~ FL-034 | Day 2 저녁 |
| E4 소유권 확인·반환 | FL-040 ~ FL-045 | Day 3 오전 |
| E5 알림 | FL-050 | Day 3 오전 |
| E6 대시보드 | FL-060 ~ FL-061 | Day 3 오전 |
| E7 시설 설정·공개 페이지 (QR은 P1) | FL-070 ~ FL-071 | Day 3 오전 |
| E8 평가·지표 | FL-080 ~ FL-082 | Day 3 오후 |
| P1 | FL-090 ~ | 해커톤 이후 |

---

## E0. 셋업

### FL-001 · 프로젝트 생성 ✅
- P0 · 1h · 의존 없음 · 완료 2026-11-25
- 범위: 저장소 루트 전체
- 수용 기준
  - [x] Next.js 16 (App Router, TypeScript strict), Tailwind 4, shadcn/ui, ESLint, Vitest, pnpm 설정
  - [x] `CLAUDE.md` §5 디렉터리 구조대로 빈 폴더·파일 생성
  - [x] `(public)`과 `admin` route group, 각각 빈 `page.tsx`
  - [x] `.env.example` (`04-architecture.md` §3), `messages/ko.json`
  - [x] `next.config.ts`에 `experimental.serverActions.bodySizeLimit: '5mb'`
  - [x] `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` 통과
  - [x] `CLAUDE.md` 첫 줄에서 `@AGENTS.md` 불러오기 (Next.js 16이 `AGENTS.md`를 관리하므로 심볼릭 링크 대신, ADR-013)
  - [x] Claude Code 설정: `.claude/` (settings, rules, commands, skills, agents, hooks), `.mcp.json`, `CLAUDE.local.md` (ADR-014)
- 참고: `CLAUDE.md`

### FL-002 · DB 스키마 마이그레이션 ✅
- P0 · 1.5h · 의존 FL-001
- 범위: `supabase/migrations/20261125061818_init_schema.sql`, `20261125062436_harden_rls_helpers.sql`, `src/lib/supabase/types.ts`
- 수용 기준
  - [x] `04-architecture.md` §4-2 테이블·enum·인덱스, §4-3 함수, §5-1 RLS 적용
  - [x] `mark_returned` RPC: 반환 처리를 한 트랜잭션으로 (§6-1 `markReturned` 설명대로)
  - [x] `updated_at` 자동 갱신 트리거
  - [x] 원격 적용 성공 (Supabase MCP `apply_migration`), 타입 생성. Supabase security advisor 0건
  - [x] RLS 확인: 다른 시설 관리자 계정으로 습득물 조회 시 0건 (PGlite 검증 + 원격 시드 계정으로 확인: 다른 시설 습득물·신고 0건, 시설·멤버 1건씩, 검색도 자기 시설만)
- 참고: `04-architecture.md` §4, §5

### FL-003 · 인증, 관리자 레이아웃, 시드 ✅
- P0 · 1.5h · 의존 FL-002
- 범위: `src/lib/supabase/{server,admin,env}.ts`, `src/proxy.ts`, `src/lib/auth/admin.ts`, `src/app/admin/(console)/layout.tsx`, `src/app/admin/login/`, `src/server/actions/auth.ts`, `scripts/seed.mts`. 브라우저용 `client.ts`는 쓰는 곳이 생길 때 만든다 (분실자 데이터는 서버에서만)
- 수용 기준
  - [x] A-01 로그인 (이메일·비밀번호), 로그아웃
  - [x] `/admin/*` 비로그인 접근 시 로그인으로 이동 (proxy, 307 확인)
  - [x] 관리자 레이아웃: 왼쪽 메뉴, 시설 이름 (`03-screens.md` §4 공통), 모바일 하단 탭
  - [x] `pnpm db:seed`: 데모 시설 5곳 이상 (학교·스키장·리조트·카페, 예시 이름, 지역·구역 포함, `is_listed = true`), 시설별 관리자 1명 — 원격 실행 완료 (5곳, 5명)
  - [x] `admin.ts` 첫 줄 `import 'server-only'`
- 참고: `03-screens.md` A-01, `04-architecture.md` §5, §11

### FL-004 · Storage ✅
- P0 · 0.5h · 의존 FL-002
- 범위: 마이그레이션 `20261125070430_storage_buckets.sql`, `src/lib/storage.ts`, `src/lib/storage-paths.ts`
- 수용 기준
  - [x] 비공개 버킷 `found-items`, `claim-photos`, `report-photos` (§5-2 표대로 3개, 5MB, jpeg·png·webp)
  - [x] 업로드 함수 (서버), 10분 만료 서명 URL 함수
  - [x] 다른 시설 경로 읽기 거부 확인 (원격, 스키장 관리자로 학교 폴더 false·자기 폴더 true·`../` 경로 false)
- 참고: `04-architecture.md` §5-2

### FL-005 · AI 클라이언트 (Gemini) ✅
- P0 · 1h · 의존 FL-001
- 범위: `src/lib/ai/client.ts`, `src/lib/ai/json.ts`, `src/lib/ai/log.ts`
- 수용 기준
  - [ ] `@google/genai` 클라이언트 1개 (`GEMINI_API_KEY`), 모델명은 환경변수
  - [ ] `generateJson(schema, contents)`: `responseMimeType`·`responseJsonSchema`로 호출 → zod 검증 → 실패·차단(`finishReason` ≠ `STOP`) 시 1회 재시도
  - [ ] `temperature`를 보내지 않는다
  - [ ] 호출 로그 `{ kind, model, latency_ms, usageMetadata, finish_reason }`, 연락처·토큰 미포함
  - [ ] `GEMINI_TIER=free`면 서버 시작 로그에 "테스트 데이터만" 경고 (ADR-025)
- 참고: `05-ai-matching.md` §8

### FL-006 · 배포
- P0 · 0.5h · 의존 FL-001
- 수용 기준
  - [ ] Vercel 연결, `main` 자동 배포, 환경변수 등록
  - [ ] 함수 리전 서울, Supabase 리전 서울
  - [ ] 배포 URL에서 로그인까지 동작
- 참고: `04-architecture.md` §11

---

## E1. 습득물 등록·관리

### FL-010 · 사진 촬영·축소 컴포넌트 ✅
- P0 · 1h · 의존 FL-001
- 범위: `src/components/photo-capture.tsx`
- 수용 기준
  - [x] 모바일에서 카메라 바로 열기 (`capture="environment"`) + 앨범 선택
  - [x] 최대 3장, 썸네일, 삭제
  - [x] 긴 변 1280px JPEG(품질 0.8)로 축소 후 `File[]` 반환
  - [x] 이미지가 아닌 파일 거부
- 참고: `03-screens.md` A-03

### FL-011 · 사진 분석 (AI 추출) ★ 🟡 코드 완료, 스파이크(실제 사진 10장) 남음
- P0 · 2.5h · 의존 FL-004, FL-005
- 범위: `src/lib/ai/prompts.ts`, `src/lib/ai/extract.ts`, `src/lib/validation/ai.ts`, `src/lib/validation/constants.ts`, `src/server/actions/items.ts`(`analyzePhoto`)
- **Day 1 스파이크**: 실제 물건 사진 10장으로 먼저 돌려보고 결과를 `eval/spike-day1.md`에 표로 남긴다 (분류 맞음/틀림, 지연 시간). 프롬프트 v1을 이걸로 확정.
- 수용 기준
  - [x] `05-ai-matching.md` §2 분류·색상 상수, §2-3 zod 스키마
  - [x] §3-2 시스템 프롬프트, structured outputs로 호출 (`thinkingLevel: LOW`)
  - [x] §3-3 후처리 (자르기, 민감 물품 강제, 개인정보 마스킹)
  - [x] `analyzePhoto`: 업로드와 분석 동시 실행, AI 실패 시 `extraction: null` (키·모델 설정이 없어도 같은 길)
  - [x] 후처리 단위 테스트 (마스킹, 민감 물품 강제)
  - [ ] 스파이크 결과 파일 — 팀이 찍은 실제 물건 사진 10장이 필요 (무료 키에는 팀 테스트 사진만)
- 참고: `05-ai-matching.md` §2, §3, §8, `04-architecture.md` §6-1

### FL-012 · 습득물 등록 화면과 저장 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 2h · 의존 FL-010, FL-011
- 범위: `src/app/admin/items/new/`, `src/server/actions/items.ts`(`createFoundItem`)
- 수용 기준
  - [x] A-03 2단계 흐름 (사진 → 확인·수정)
  - [x] AI가 채운 필드 옅은 배경, 수정하면 일반 배경
  - [x] 민감 물품 경고 배너, AI 실패 배너 + 빈 양식
  - [x] 10초 경과 시 "직접 입력하기" 버튼 (먼저 고친 칸은 AI 결과가 와도 덮어쓰지 않음)
  - [x] 습득 일시 기본값 지금, 보관 위치 직전 값 기본 (이 기기, 시설별)
  - [x] 저장: `transfer_due_at` 계산, `register_started_at` 저장, 이벤트 `registered`
  - [x] [저장하고 계속 등록]
  - [x] [민감 물품] 버튼: AI 분석 없이 분류만 골라 저장 (`createSensitiveItem`), 사진을 외부 AI로 보내지 않음
- 참고: `03-screens.md` A-03, `02-user-flows.md` §2

### FL-013 · 습득물 목록 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 1.5h · 의존 FL-012
- 범위: `src/app/admin/items/page.tsx`
- 수용 기준
  - [x] 썸네일(서명 URL), 분류, 공개 설명, 습득일, 보관 위치, 상태 배지, 후보 수
  - [x] 필터: 상태, 분류, 기간 (URL 쿼리에 유지), 탭(전체/확인 필요/분석 중), 50건씩 페이지
  - [x] 태블릿 표 / 모바일 카드, 빈 상태, 검색 결과 없음 → 대리 신고 안내
- 참고: `03-screens.md` A-04

### FL-014 · 습득물 상세, 수정 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 2h · 의존 FL-013
- 범위: `src/app/admin/items/[id]/`, `updateFoundItem`
- 수용 기준
  - [x] 사진 넘겨보기, 전체 정보(비공개 특징 포함), 수정 (`updateFoundItem`, `search_text`·보관 기한 다시 계산, 이벤트 `edited`)
  - [x] 특징 관련 필드(분류·색상·브랜드·비공개 특징)와 습득 일시·구역 수정 시 재매칭 (`after()`)
  - [x] 처리 이력 타임라인 (`item_events`)
  - 후보를 눌러 신고 상세(서랍)를 여는 것은 관리자 신고 화면(FL-024)에서 붙인다
- 참고: `03-screens.md` A-05

### FL-015 · 관리자 자연어 검색 ✂️
- P0 · 1h · 의존 FL-013, FL-005
- 범위: A-04 검색창, `searchItems`
- 수용 기준
  - [ ] `search_items` RPC (키워드·글자 유사도, pg_trgm) → 결과 목록. 의미 검색은 Stage 2
  - [ ] 결과 없음 → A-07 대리 신고 유도 문구
  - [ ] "검은 이어폰 은색 키링"으로 시드 데이터의 해당 이어폰이 3위 안
- 참고: `02-user-flows.md` §7

### FL-016 · 빠른 등록 모드 (연속 촬영) ✂️
- P0 · 2h · 의존 FL-012, FL-032
- 범위: A-03 빠른 등록 토글, `quickCreateFoundItem`, A-04 "확인 필요"·"분석 중" 탭
- 수용 기준
  - [ ] 사진 → 보관 위치(직전 값) → 저장 → 바로 다음 촬영. 관리자 조작 5초 이내 (직접 측정, AI 대기 제외)
  - [ ] AI 분석·매칭은 백그라운드
  - [ ] 확신도 0.6 미만이나 민감 물품이면 `review_needed = true` → A-04 "확인 필요" 탭
  - [ ] AI가 끝나기 전 항목은 목록에 "분석 중" 표시
- 참고: `02-user-flows.md` §2-1, `04-architecture.md` §6-1

---

## E2. 분실 신고

### FL-020 · 시설 페이지, 습득자 안내 ✅
- P0 · 1h · 의존 FL-003
- 범위: `src/app/(public)/f/[slug]/page.tsx`, `src/app/(public)/f/[slug]/found/page.tsx`, `src/lib/facilities/{get-facility,page-data,load}.ts`, `src/components/public/{public-shell,desk-info,facility-states,remember-facility}.tsx`
- 수용 기준
  - [x] P-02 버튼 2개, 연락처, 운영 시간 (비어 있는 정보는 줄째 숨김)
  - [x] 검색엔진용 메타데이터: 제목 "{시설 이름} 분실물 찾기 | 잇츠미", 설명. `is_listed = false`면 noindex
  - [x] P-06 맡기는 곳 안내 (Figma 시안 없음: P-02 부품으로 구성)
  - [x] 없는 slug → 에러 문구 (형식이 틀린 slug도 같음, noindex)
  - [x] 시설 정보는 service role로 §9-2 허용 필드만 조회 (`toFacilityPage` 테스트, 화면 HTML에 주소 없음 확인). `use cache` + 태그 `facility:{slug}`, A-08 저장 때 `revalidateTag`
- 참고: `03-screens.md` P-02, P-06

### FL-021 · 분실 신고 양식과 저장 ✅
- P0 · 2.5h · 의존 FL-020
- 범위: `src/app/(public)/f/[slug]/report/`, `src/components/public/report/`, `src/server/actions/reports.ts`(`createLostReport`), `src/lib/validation/{report,contact}.ts`, `src/lib/dates.ts`. "물건이 나온 사진" 올리기는 FL-027에서
- 수용 기준
  - [x] P-03 3단계, 단계 이동 시 값 유지(브라우저 뒤로 가기 포함), 진행 표시
  - [x] 분류나 설명 중 하나만 있어도 제출. 색상·브랜드·구역·시간대에 "잘 모르겠어요" (`null`로 저장)
  - [x] 시간대(오전/점심/오후/저녁/모름), 대여 물품 체크 저장. 대여면 렌탈샵 안내 (안내 문구는 P-04, FL-023)
  - [x] 검증·에러 문구 (`03-screens.md` P-03)
  - [x] 토큰 `randomBytes(24)` base64url, honeypot 입력칸
  - [x] `report_started_at` 저장, 이벤트 `report_created`
  - [x] 제출 후 `/r/{token}?new=1` 이동, 응답 1초 이내 (저장만 하고 정규화·매칭은 응답 뒤, FL-022·031)
  - [x] 중복 제출 방지 (버튼 잠금 + 같은 연락처·내용 60초 안 재제출은 첫 신고로 보냄. 두 번 눌러 1건 저장 확인)
- 참고: `03-screens.md` P-03, `02-user-flows.md` §3, `04-architecture.md` §6-2

### FL-022 · 설명 정규화와 비교용 텍스트 🟡 코드 완료, "에어팟" 실제 응답 확인 남음
- P0 · 1.5h · 의존 FL-011, FL-021
- 범위: `src/lib/ai/normalize.ts`, `src/lib/matching/search-text.ts`, `processReport`의 앞부분
- 수용 기준
  - [x] §4-2 프롬프트, 연락처 미포함 확인 테스트 (글 속 전화번호·이메일도 가림)
  - [x] `buildSearchText` (§2-4) + 단위 테스트
  - [x] 정규화 실패 시 원문으로 판정, `ai_status = failed` — 개발 DB에서 Gemini 503일 때 확인
  - [ ] "에어팟 잃어버렸어요" → brand `Apple`, 분류 `electronics.earphones` — 테스트 당시 Gemini가 503을 돌려줘 실제 응답 미확인. FL-081 평가 케이스에 넣는다
- 참고: `05-ai-matching.md` §2-4, §4

### FL-023 · 신고 현황 페이지 ✅
- P0 · 2h · 의존 FL-021
- 범위: `src/app/(public)/r/[token]/page.tsx`, `src/lib/reports/{view,get-view}.ts`(`getReportView`), `src/components/public/status/`
- 수용 기준
  - [x] 첫 진입 배너 + 링크 복사 (대여 물품이면 렌탈샵 안내도)
  - [x] 분석 중 / 후보 없음 / 후보 카드 / 확인 중 / 승인됨 상태별 화면 (+ 추가 증빙 요청, 취소됨)
  - [x] 분석 중이면 5초마다 새로고침
  - [x] **§9-2 허용 필드만 반환** (테스트로 확인: 응답에 `private_features`, `photo_paths`, `score` 없음. 실제 화면 HTML에도 비공개 특징·보관 위치·점수 없음 확인)
  - [x] 민감 물품은 분류만 표시
  - [ ] 정보 충족도가 낮으면 "정보가 적어요" 안내 + [신고 내용 보완하기] (`updateLostReport` → 다시 매칭) — 안내는 완료, 보완하기는 다시 매칭이 생기는 FL-031 뒤에
- 참고: `03-screens.md` P-04, `04-architecture.md` §9-2

### FL-024 · 관리자 신고 목록, 대리 신고 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 1.5h · 의존 FL-021 · 대리 신고 ✂️
- 범위: `src/app/admin/reports/`, `createReportByAdmin`
- 수용 기준
  - [x] 목록: 신고일, 설명 첫 줄, 기간, 상태, 후보 수, 접수 경로 (+ 문의 수, 상태·경로·기간 필터, 50건씩)
  - [x] 대리 신고 한 화면 양식, 완료 후 링크 복사 (`createReportByAdmin`)
  - [x] 신고 서랍: 내용·연락처·나만 아는 특징·후보·문의 기록, [신고 링크 복사], 실패 시 [다시 분석] (FL-032의 A-07 몫)
- 참고: `03-screens.md` A-07

### FL-025 · 같은 연락처 신고 묶기 🟡 알림 1통 규칙은 FL-050에서
- P0 · 1.5h · 의존 FL-021, FL-024
- 범위: `src/lib/validation/contact.ts`, `createLostReport`·`createReportByAdmin`의 `contact_key` 계산, A-07 묶음 표시, `findReportsByContact`
- 수용 기준
  - [x] `toContactKey()`: 전화번호 숫자만·앞의 82는 0으로, 이메일은 소문자. 단위 테스트
  - [x] 같은 전화번호로 신고 2건 → A-07에서 "같은 분 신고 2건" 한 묶음 (`groupReports`, 테스트)
  - [x] 연락처(뒷자리 4개 또는 이메일)로 신고 검색 (`parseContactSearch`, 테스트)
  - [x] 분실자 응답(`getReportView`)에 `contact_key`와 다른 신고 정보가 없다 (테스트, FL-023 때 작성)
  - [ ] 같은 `contact_key`의 신고들에 같은 습득물 알림은 1통만 (FL-050에서 연결)
- 참고: `01-prd.md` F9, `02-user-flows.md` §7-1, `04-architecture.md` §6-5

### FL-026 · 문의 기록 ✂️
- P0 · 1.5h · 의존 FL-025
- 범위: A-10 모달, `logInquiry`, `listInquiries`, A-07 서랍의 문의 타임라인, A-02 [문의 기록] 버튼
- 수용 기준
  - [ ] 채널·연결 신고·메모를 남기고, 응대자·시각은 자동
  - [ ] 신고 서랍에 문의 기록이 시간순으로 보인다
  - [ ] 신고 없이도 연락처로 기록할 수 있고, 나중에 같은 연락처 신고가 생기면 묶음에 보인다
  - [ ] 모달 열기부터 저장까지 10초 안 (직접 측정)
- 참고: `03-screens.md` A-10, `02-user-flows.md` §7

### FL-027 · 내 사진으로 찾기 ✂️
- P0 · 1.5h · 의존 FL-011, FL-021
- 범위: P-03 사진 첨부(선택), `report-photos` 버킷, `processReport`의 사진 특징 추출
- 수용 기준
  - [ ] 분실자가 물건이 나온 사진 1~3장을 올리면 §4-4 추출 → 정규화 결과와 합쳐 비교용 텍스트로
  - [ ] 글과 사진이 다르면 글 우선
  - [ ] 사진은 비공개, A-06에서 관리자만 보조 근거로 본다
  - [ ] 글 없이 분류 + 사진만으로도 후보가 나온다 (평가 3건 이상)
- 참고: `05-ai-matching.md` §4-4, `01-prd.md` F4-7

### FL-028 · 시설 찾기 (홈) ✅
- P0 · 2h · 의존 FL-002, FL-003
- 범위: `src/app/(public)/page.tsx`(P-01), `src/lib/facilities/{public,search}.ts`(`searchFacilities`), `search_facilities` RPC, `src/lib/recent-facilities.ts`, `src/components/public/`
- 수용 기준
  - [x] 시설 이름·지역 검색, 종류 칩 필터, 결과 → P-02 (`/f/{slug}` 링크. 페이지는 P-02 티켓)
  - [x] `is_listed = true`인 시설만, §9-2 허용 필드만 반환 (`toPublicFacility` 테스트, 화면 HTML에 주소·`is_listed` 없음 확인)
  - [x] 결과 없음: 미참여 안내 + LOST112 주소
  - [x] 최근 본 시설은 이 기기에만 저장 (localStorage, 읽기 실패해도 화면은 정상). 저장은 P-02에서 `rememberFacility()` 호출
  - [x] 데모 시설은 실제 상호가 아닌 예시 이름 (ADR-028)
- 참고: `03-screens.md` P-01, `01-prd.md` F11

---

## E3. 매칭

### FL-030 · 점수 함수 ✅
- P0 · 1.5h · 의존 FL-001
- 범위: `src/lib/matching/score.ts`, `score.test.ts`
- 수용 기준
  - [ ] `05-ai-matching.md` §5-3 시그니처
  - [ ] §5-1 표의 모든 칸 테스트, 제외 규칙 테스트
  - [ ] 예시 입력 → 0.922 테스트
  - [ ] 동적 가중치: 모르는 신호는 빼고 계산, `coverage` 반환. 예시 2 테스트
  - [ ] 시간대 보정 (잃어버리기 전에 습득 → 날짜 점수 × 0.3)
  - [ ] 설정값(가중치, 임계값, COS 구간)은 인자로 주입 가능
- 참고: `05-ai-matching.md` §5

### FL-031 · 매칭 실행 ✅
- P0 · 2h · 의존 FL-022, FL-030
- 범위: `src/lib/matching/run.ts`, `src/lib/ai/judge.ts`
- 수용 기준
  - [x] `matchForReport(reportId)`, `matchForItem(itemId)` — 후보 추리기 RPC → AI 유사도 판정(`05-ai-matching.md` §5-4, 20개씩) → 점수 → 저장
  - [x] 판정이 실패한 묶음은 중립값 0.5, 알림 없음
  - [x] §6 저장 규칙 전부 (upsert, `suggested`만 갱신, dismissed 재생성 금지, 상위 5개) — `plan.test.ts`
  - [x] 같은 함수를 두 번 실행해도 결과 동일 (테스트)
  - [x] 알림 대상(새로 0.70 이상, coverage 0.65 이상) 목록 반환, `coverage` 저장
  - [x] 상위 후보 점수 차 0.05 이내면 `breakdown.tie = true`
- 참고: `05-ai-matching.md` §6

### FL-032 · 백그라운드 연결과 실패 처리 ✅
- P0 · 1h · 의존 FL-031
- 범위: `processReport`, `processItem`, `retryAnalysis`
- 수용 기준
  - [x] 신고·습득물 저장 후 `after()`로 실행 (습득물 수정 시에도)
  - [x] 단계별 실패 시 `ai_status = failed`, 이후 단계 계속 — 개발 DB에서 확인
  - [x] A-05·A-07에 실패 표시 + [다시 분석] (`retryAnalysis`, `retryReportAnalysis`)
  - [x] 신고 후 30초 안에 P-04에 결과 반영 — 개발 서버에서 약 15초
- 참고: `04-architecture.md` §7, `02-user-flows.md` §10

### FL-033 · 관리자 화면에 후보 표시 ✅
- P0 · 1h · 의존 FL-031, FL-014
- 수용 기준
  - [x] A-05 매칭 후보 섹션 (신고 요약, 유사도, 상태, 맞는 특징·다른 점·정보가 적어요), 누르면 A-07 신고 서랍
  - [x] 목록의 "후보 n" 배지
- 참고: `03-screens.md` A-05

### FL-034 · 후보 숨김, 신고 취소 ✅ (FL-023과 함께, DB 함수 `dismiss_candidate_by_reporter`·`cancel_lost_report`)
- P0 · 1h · 의존 FL-023
- 범위: `dismissCandidate`, `cancelReport`
- 수용 기준
  - [x] 토큰 소유 확인 후 처리
  - [x] 숨긴 후보는 재매칭해도 다시 안 나타남 — `plan.test.ts`, 쓰기마다 `status = 'suggested'` 조건
  - [x] 취소 시 신고 `closed`, 후보 `dismissed (report_closed)`
- 참고: `02-user-flows.md` §5, §9

---

## E4. 소유권 확인·반환

### FL-040 · 소유권 확인 요청 (분실자) ✅ (AI 답변 비교는 FL-044 ✂️)
- P0 · 2h · 의존 FL-023
- 범위: `src/app/(public)/r/[token]/claim/[candidateId]/`, `submitClaim`, `src/lib/validation/claim-questions.ts`
- 수용 기준
  - [x] 분류별 확인 질문 2~3개 (`05-ai-matching.md` §9-1), 주관식, 1개 이상 필수, 사진 첨부 선택 (`claim-photos` 버킷)
  - [x] 같은 분류의 두 습득물에 같은 질문이 나간다 (테스트)
  - [x] 진행 중 요청이 있거나 같은 쌍을 이미 2번 요청했으면 거부 + 안내 문구 (DB 함수 `submit_claim`, PGlite 시나리오 확인)
  - [x] 후보·습득물·신고 상태 `claimed`, 이벤트 `claimed` — 개발 DB에서 확인
  - [x] 고가품 분류면 "받으러 오실 때 잠금 해제나 일련번호 확인이 필요해요" 안내
- 참고: `03-screens.md` P-05, `02-user-flows.md` §5

### FL-041 · 소유권 검토 (관리자) ★ 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 2h · 의존 FL-040
- 범위: `src/app/admin/claims/`, `reviewClaim`
- 수용 기준
  - [x] 목록 + 3단 비교 상세 (분실자 답변 / AI 비교 / 보관 중인 물건, `03-screens.md` A-06) — AI 비교 칸은 FL-044(✂️) 전까지 "직접 비교" 안내
  - [x] 같은 습득물의 다른 요청 경고
  - [x] 승인: 수령 안내 입력(고가품·지갑·신분증은 필수 증빙 자동 표시), 후보 `approved` / 거절: 내부 메모, 상태 복귀 (§9 다이어그램대로, DB 함수 `review_claim`, PGlite 시나리오 확인)
  - [x] 같은 연락처의 최근 확인 요청 경고 (`05-ai-matching.md` §9-4)
  - [x] 거절 사유가 분실자 화면에 노출되지 않음 (P-04는 "확인되지 않았어요"만, 테스트)
- 참고: `02-user-flows.md` §6

### FL-042 · 반환 처리 🟡 코드 완료, 로그인 상태 화면 확인 남음
- P0 · 1h · 의존 FL-041
- 범위: A-09 모달, `markReturned` (`mark_returned` RPC)
- 수용 기준
  - [x] 수령인 이름 필수, 확인 방법, 메모 (`markReturned`, 테스트)
  - [x] 신고 연결 / 신고 없이 반환 둘 다 가능 (승인된 후보만 연결 목록에)
  - [x] 습득물 `returned`, 신고 `resolved`, 다른 후보 `dismissed (item_returned)` — 한 트랜잭션 (`mark_returned`, PGlite 시나리오 확인)
- 참고: `03-screens.md` A-09

### FL-043 · 이관·폐기 처리 ✅
- P0 · 0.5h · 의존 FL-014
- 수용 기준
  - [x] 확인 대화상자(메모 선택), 상태 변경, 관련 후보 `dismissed`, 이벤트 — DB 함수 `set_found_item_status` 한 트랜잭션
- 참고: `04-architecture.md` §6-1 `setFoundItemStatus`

### FL-044 · AI 답변 비교 (소유권 확인 보조) ✂️
- P0 · 2h · 의존 FL-040, FL-005
- 범위: `src/lib/ai/verify.ts`, `src/lib/validation/ai.ts`(`OwnershipVerdict`), `submitClaim`의 `after()`
- 수용 기준
  - [ ] `05-ai-matching.md` §9-2 입력·출력, §9-3 프롬프트. 연락처가 입력에 없다는 테스트
  - [ ] 결과를 `ai_verdict`에 저장, 실패하면 null (관리자가 직접 비교)
  - [ ] `getReportView`와 이메일에 `ai_verdict`가 없다 (테스트)
  - [ ] 평가셋의 진짜 주인·가짜 요청으로 §9-5 지표 산출 (FL-081에 포함)
- 참고: `05-ai-matching.md` §9

### FL-045 · 추가 증빙 요청과 보류 ✅
- P0 · 1.5h · 의존 FL-041
- 범위: `reviewClaim`(`request_proof`, `hold`), `submitProof`, P-04 추가 증빙 상태, A-06 버튼
- 수용 기준
  - [x] 관리자가 요청 내용을 적으면 후보 `needs_proof`, 분실자 신고 링크에 요청이 보인다 (DB 함수 `review_claim`, P-04 Figma 32:218)
  - [x] 분실자가 답·사진을 보내면 `claimed`로 돌아와 검토 대기에 다시 뜬다 (`submitProof` → `submit_proof`)
  - [x] 보류는 상태를 바꾸지 않고 내부 메모만 남긴다 (`review_claim(..., 'hold')`)
  - [x] A-06의 [추가 증빙 요청] [보류] 버튼과 대화상자
- 참고: `02-user-flows.md` §6, §9-3

---

## E5. 알림

### FL-050 · 이메일 (새 후보 자동 알림) 🟡 코드 완료, Resend 키·보내는 주소 설정 후 실제 발송 확인 남음
- P0 · 1.5h · 의존 FL-031, FL-041
- 범위: `src/lib/notify/`
- 수용 기준
  - [x] 3종 템플릿 (`04-architecture.md` §8) — 신고 접수, 새 후보, 승인
  - [x] 본문에 공개 설명만, 사진·비공개 특징·점수 없음 (민감 물품은 분류만, 테스트)
  - [x] 신고당 24시간 최대 3통 (`item_events` `notified`로 셈), 같은 연락처의 같은 습득물은 1통
  - [x] 발송 실패해도 매칭·승인 처리는 성공 (`after()`, 키가 없으면 보내지 않고 기록만)
- 참고: `04-architecture.md` §8

---

## E6. 대시보드

### FL-060 · KPI와 할 일
- P0 · 1h · 의존 FL-042
- 수용 기준
  - [ ] KPI 5개 (`01-prd.md` F8-1, 반환율 정의대로. 이번 주 문의 수는 FL-026 이후)
  - [ ] 할 일: 확인 요청 대기, 이관 기한 3일 이내
  - [ ] [+ 습득물 등록] 버튼 (모바일 하단 고정)
- 참고: `03-screens.md` A-02

### FL-061 · 주간 차트 ✂️
- P0 · 1h · 의존 FL-060
- 수용 기준: 최근 7일 습득·반환 막대 차트

---

## E7. 시설 설정·QR

### FL-070 · 시설 설정과 공개 페이지
- P0 · 1.5h · 의존 FL-003
- 범위: `src/app/admin/settings/`
- 수용 기준
  - [ ] 시설 정보·구역 목록·보관 기한 수정 (owner만)
  - [ ] 지역·주소·종류·소개 입력, 시설 페이지 주소 [복사], 검색 노출 동의(`is_listed`)
  - [ ] 홈페이지 메뉴·예약 문자·전화 응대용 링크와 안내 문구 [복사] (`01-prd.md` F1-5)
- 참고: `03-screens.md` A-08

### FL-071 · QR 코드·포스터 (P1)
- P1 · 1.5h · 의존 FL-070
- 범위: `src/app/api/qr/[slug]/route.ts`, A-08 QR 영역
- 수용 기준: QR PNG 내려받기 (주소 `NEXT_PUBLIC_APP_URL/f/{slug}`) + A4 포스터 (시설명, QR, 안내 문구 2줄). 현장 보조 수단 (ADR-026)

---

## E8. 평가·지표

### FL-080 · 평가 데이터
- P0 · 1h (+ 팀 수집 시간) · 의존 없음
- 범위: `eval/cases.json`, `eval/photos/`, `eval/README.md`
- 수용 기준
  - [ ] `05-ai-matching.md` §7-1 수집 절차를 팀원용으로 한 장 정리
  - [ ] 습득물 30개 이상, 미끼 신고 10건, 비슷한 물건 묶음 4개 이상, 중복 신고 3쌍, 진짜 주인 확인 답변과 가짜 확인 요청 각 10건 이상, 기억이 흐린 신고 10건
  - [ ] `split` dev/test 반반
- 참고: `05-ai-matching.md` §7-1, §7-2

### FL-081 · 평가 스크립트
- P0 · 2h · 의존 FL-031, FL-080
- 범위: `eval/run.ts`, `package.json`의 `eval` 스크립트
- 수용 기준
  - [ ] §7-3 절차 (평가 전용 시설 생성 → 실행 → 결과 → 정리)
  - [ ] §7-4 지표 전부, dev/test 따로
  - [ ] `eval/results/YYYY-MM-DD.md` 저장
- 참고: `05-ai-matching.md` §7

### FL-082 · 소요시간 지표
- P0 · 1h · 의존 FL-012, FL-021
- 수용 기준
  - [ ] 등록·신고 소요시간 중앙값·p90을 뽑는 SQL (`scripts/metrics.sql`)
  - [ ] 하루 문의 수, 같은 분 재문의 수 SQL (`inquiries`)
  - [ ] 사용성 테스트 결과를 같은 형식으로 기록하는 표 (`eval/usability.md`)
- 참고: `01-prd.md` §7, `04-architecture.md` §10

---

## P1 (해커톤 이후)

| ID | 내용 | 참고 |
|---|---|---|
| FL-090 | 다국어 신고 (EN/JA/ZH): `messages/*.json`, 언어 선택 | PRD §4 P1 |
| FL-091 | Stage 2: 임베딩 검색 (`gemini-embedding-2` + pgvector) + AI 판정 재순위 | `05-ai-matching.md` §10, ADR-023 |
| FL-092 | 같은 지역 여러 시설 통합 매칭 | ADR-010 |
| FL-093 | 이관 기한 알림 (이메일) | PRD §4 P1 |
| FL-094 | 종료 30일 후 연락처 자동 삭제 (Vercel Cron) | `04-architecture.md` §6-4 |
| FL-095 | 분실자 요청 수 제한 | `04-architecture.md` §9-1 |
| FL-096 | 신고 링크 이메일 재발송 | `02-user-flows.md` §10 |
| FL-097 | 반환 방법: 수령 예약, 대리 수령, 착불 택배, 이관 안내 (P-07) | PRD F10 |
| FL-098 | Playwright E2E: 등록 → 신고 → 확인 요청 → 반환 | `CLAUDE.md` §3 |
| FL-099 | 시설 셀프 등록(멀티테넌트 가입)·관리자 초대 | Q7, ADR-026 |
| FL-100 | 설명이 비슷한 중복 신고 감지 (연락처가 달라도) | PRD F9-3 |
| FL-101 | 문의 통계 (요일·시간대·채널별) | PRD §4 P1 |
| FL-102 | 확인 요청 전 연락처 인증 (이메일 코드) | PRD §4 P1 |
| FL-103 | AI 상황 기반 추가 질문 (신고 뒤 빈 항목을 채우도록 묻기) | PRD §4 P1 |
| FL-104 | Stage 3: LangChain(JS)·LangGraph 파이프라인 검토 (문의 응답 챗봇, 시설 간 탐색) | `05-ai-matching.md` §10 |
| FL-105 | 여러 시설 한 번에 신고 (P-08, `report_groups`) | PRD F11-4, ADR-027 |
| FL-106 | 지역 기반 통합 탐색 | PRD F11-5 |
| FL-107 | (P2) 지도에서 시설 찾기 | PRD F11-6 |
| FL-108 | (P2) 방문 기록 연동 (예약·결제 기록에서 방문 시설 제안) | PRD F11-7 |
