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
| E1 습득물 등록·관리 | FL-010 ~ FL-015 | Day 1 (FL-011 스파이크), Day 2 오전 |
| E2 분실 신고 | FL-020 ~ FL-024 | Day 2 오후 |
| E3 매칭 | FL-030 ~ FL-034 | Day 2 저녁 |
| E4 소유권 확인·반환 | FL-040 ~ FL-043 | Day 3 오전 |
| E5 알림 | FL-050 | Day 3 오전 ✂️ |
| E6 대시보드 | FL-060 ~ FL-061 | Day 3 오전 |
| E7 시설 설정·QR | FL-070 ~ FL-071 | Day 3 오전 |
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

### FL-002 · DB 스키마 마이그레이션
- P0 · 1.5h · 의존 FL-001
- 범위: `supabase/migrations/0001_init.sql`, `src/lib/supabase/types.ts`
- 수용 기준
  - [ ] `04-architecture.md` §4-2 테이블·enum·인덱스, §4-3 함수, §5-1 RLS 적용
  - [ ] `mark_returned` RPC: 반환 처리를 한 트랜잭션으로 (§6-1 `markReturned` 설명대로)
  - [ ] `updated_at` 자동 갱신 트리거
  - [ ] `supabase db push` 성공, `pnpm db:types`로 타입 생성
  - [ ] RLS 확인: 다른 시설 관리자 계정으로 습득물 조회 시 0건
- 참고: `04-architecture.md` §4, §5

### FL-003 · 인증, 관리자 레이아웃, 시드
- P0 · 1.5h · 의존 FL-002
- 범위: `src/lib/supabase/{server,client,admin}.ts`, `src/app/admin/layout.tsx`, `src/app/admin/login/`, `scripts/seed.ts`
- 수용 기준
  - [ ] A-01 로그인 (이메일·비밀번호), 로그아웃
  - [ ] `/admin/*` 비로그인 접근 시 로그인으로 이동
  - [ ] 관리자 레이아웃: 왼쪽 메뉴, 시설 이름 (`03-screens.md` §4 공통)
  - [ ] `pnpm db:seed`: 시설 1개 (인덕대 데모, 구역 5개), 관리자 1명
  - [ ] `admin.ts` 첫 줄 `import 'server-only'`
- 참고: `03-screens.md` A-01, `04-architecture.md` §5, §11

### FL-004 · Storage
- P0 · 0.5h · 의존 FL-002
- 범위: 마이그레이션 `0002_storage.sql`, `src/lib/storage.ts`
- 수용 기준
  - [ ] 비공개 버킷 `found-items`, `claim-photos`
  - [ ] 업로드 함수 (서버), 10분 만료 서명 URL 함수
  - [ ] 다른 시설 경로 읽기 거부 확인
- 참고: `04-architecture.md` §5-2

### FL-005 · AI·임베딩 클라이언트
- P0 · 1h · 의존 FL-001
- 범위: `src/lib/ai/client.ts`, `src/lib/ai/embed.ts`, `src/lib/ai/log.ts`
- 수용 기준
  - [ ] Anthropic SDK 클라이언트 1개, 모델명은 환경변수
  - [ ] fallback 설정, `stop_reason` 확인 헬퍼 (`refusal`, `max_tokens`)
  - [ ] `embed(texts: string[]): Promise<number[][]>` — 차원이 `EMBEDDING_DIM`과 다르면 에러
  - [ ] 호출 로그 `{ kind, model, latency_ms, usage, stop_reason }`, 연락처·토큰 미포함
- 참고: `05-ai-matching.md` §8, `CLAUDE.md` §7

### FL-006 · 배포
- P0 · 0.5h · 의존 FL-001
- 수용 기준
  - [ ] Vercel 연결, `main` 자동 배포, 환경변수 등록
  - [ ] 함수 리전 서울, Supabase 리전 서울
  - [ ] 배포 URL에서 로그인까지 동작
- 참고: `04-architecture.md` §11

---

## E1. 습득물 등록·관리

### FL-010 · 사진 촬영·축소 컴포넌트
- P0 · 1h · 의존 FL-001
- 범위: `src/components/photo-capture.tsx`
- 수용 기준
  - [ ] 모바일에서 카메라 바로 열기 (`capture="environment"`) + 앨범 선택
  - [ ] 최대 3장, 썸네일, 삭제
  - [ ] 긴 변 1280px JPEG(품질 0.8)로 축소 후 `File[]` 반환
  - [ ] 이미지가 아닌 파일 거부
- 참고: `03-screens.md` A-03

### FL-011 · 사진 분석 (AI 추출) ★
- P0 · 2.5h · 의존 FL-004, FL-005
- 범위: `src/lib/ai/prompts.ts`, `src/lib/ai/extract.ts`, `src/lib/validation/ai.ts`, `src/lib/validation/constants.ts`, `src/server/actions/items.ts`(`analyzePhoto`)
- **Day 1 스파이크**: 실제 물건 사진 10장으로 먼저 돌려보고 결과를 `eval/spike-day1.md`에 표로 남긴다 (분류 맞음/틀림, 지연 시간). 프롬프트 v1을 이걸로 확정.
- 수용 기준
  - [ ] `05-ai-matching.md` §2 분류·색상 상수, §2-3 zod 스키마
  - [ ] §3-2 시스템 프롬프트, structured outputs로 호출
  - [ ] §3-3 후처리 (자르기, 민감 물품 강제, 개인정보 마스킹)
  - [ ] `analyzePhoto`: 업로드와 분석 동시 실행, AI 실패 시 `extraction: null`
  - [ ] 후처리 단위 테스트 (마스킹, 민감 물품 강제)
  - [ ] 스파이크 결과 파일
- 참고: `05-ai-matching.md` §2, §3, §8, `04-architecture.md` §6-1

### FL-012 · 습득물 등록 화면과 저장
- P0 · 2h · 의존 FL-010, FL-011
- 범위: `src/app/admin/items/new/`, `src/server/actions/items.ts`(`createFoundItem`)
- 수용 기준
  - [ ] A-03 2단계 흐름 (사진 → 확인·수정)
  - [ ] AI가 채운 필드 옅은 배경, 수정하면 일반 배경
  - [ ] 민감 물품 경고 배너, AI 실패 배너 + 빈 양식
  - [ ] 10초 경과 시 "직접 입력하기" 버튼
  - [ ] 습득 일시 기본값 지금, 보관 위치 직전 값 기본
  - [ ] 저장: `transfer_due_at` 계산, `register_started_at` 저장, 이벤트 `registered`
  - [ ] [저장하고 계속 등록]
- 참고: `03-screens.md` A-03, `02-user-flows.md` §2

### FL-013 · 습득물 목록
- P0 · 1.5h · 의존 FL-012
- 범위: `src/app/admin/items/page.tsx`
- 수용 기준
  - [ ] 썸네일(서명 URL), 분류, 공개 설명, 습득일, 보관 위치, 상태 배지, 후보 수
  - [ ] 필터: 상태, 분류, 기간 (URL 쿼리에 유지)
  - [ ] 태블릿 표 / 모바일 카드, 빈 상태
- 참고: `03-screens.md` A-04

### FL-014 · 습득물 상세, 수정
- P0 · 2h · 의존 FL-013
- 범위: `src/app/admin/items/[id]/`, `updateFoundItem`
- 수용 기준
  - [ ] 사진 넘겨보기, 전체 정보(비공개 특징 포함), 수정
  - [ ] 특징 관련 필드 수정 시 재임베딩·재매칭 (`after()`, FL-032 연결 전엔 TODO)
  - [ ] 처리 이력 타임라인 (`item_events`)
- 참고: `03-screens.md` A-05

### FL-015 · 관리자 자연어 검색 ✂️
- P0 · 1h · 의존 FL-013, FL-005
- 범위: A-04 검색창, `searchItems`
- 수용 기준
  - [ ] 검색어 임베딩 → `search_items` RPC → 결과 목록
  - [ ] 결과 없음 → A-07 대리 신고 유도 문구
  - [ ] "검은 이어폰 은색 키링"으로 시드 데이터의 해당 이어폰이 3위 안
- 참고: `02-user-flows.md` §7

---

## E2. 분실 신고

### FL-020 · 시설 랜딩, 습득자 안내
- P0 · 1h · 의존 FL-003
- 범위: `src/app/(public)/f/[slug]/page.tsx`, `src/app/(public)/f/[slug]/found/page.tsx`
- 수용 기준
  - [ ] P-02 버튼 2개, 연락처, 운영 시간
  - [ ] P-06 맡기는 곳 안내
  - [ ] 없는 slug → 에러 문구
  - [ ] 시설 정보는 service role로 §9-2 허용 필드만 조회
- 참고: `03-screens.md` P-02, P-06

### FL-021 · 분실 신고 양식과 저장
- P0 · 2.5h · 의존 FL-020
- 범위: `src/app/(public)/f/[slug]/report/`, `src/server/actions/reports.ts`(`createLostReport`)
- 수용 기준
  - [ ] P-03 3단계, 단계 이동 시 값 유지, 진행 표시
  - [ ] 검증·에러 문구 (`03-screens.md` P-03)
  - [ ] 토큰 `randomBytes(24)` base64url, honeypot 입력칸
  - [ ] `report_started_at` 저장, 이벤트 `report_created`
  - [ ] 제출 후 `/r/{token}?new=1` 이동, 응답 1초 이내
  - [ ] 중복 제출 방지
- 참고: `03-screens.md` P-03, `02-user-flows.md` §3, `04-architecture.md` §6-2

### FL-022 · 설명 정규화와 임베딩
- P0 · 1.5h · 의존 FL-011, FL-021
- 범위: `src/lib/ai/normalize.ts`, `src/lib/matching/search-text.ts`, `processReport`의 앞부분
- 수용 기준
  - [ ] §4-2 프롬프트, 연락처 미포함 확인 테스트
  - [ ] `buildSearchText` (§2-4) + 단위 테스트
  - [ ] 정규화 실패 시 원문으로 임베딩, `ai_status = failed`
  - [ ] "에어팟 잃어버렸어요" → brand `Apple`, 분류 `electronics.earphones`
- 참고: `05-ai-matching.md` §2-4, §4

### FL-023 · 신고 현황 페이지
- P0 · 2h · 의존 FL-021
- 범위: `src/app/(public)/r/[token]/page.tsx`, `getReportView`
- 수용 기준
  - [ ] 첫 진입 배너 + 링크 복사
  - [ ] 분석 중 / 후보 없음 / 후보 카드 / 확인 중 / 승인됨 상태별 화면
  - [ ] 분석 중이면 5초마다 새로고침
  - [ ] **§9-2 허용 필드만 반환** (테스트로 확인: 응답에 `private_features`, `photo_paths`, `score` 없음)
  - [ ] 민감 물품은 분류만 표시
- 참고: `03-screens.md` P-04, `04-architecture.md` §9-2

### FL-024 · 관리자 신고 목록, 대리 신고
- P0 · 1.5h · 의존 FL-021 · 대리 신고 ✂️
- 범위: `src/app/admin/reports/`, `createReportByAdmin`
- 수용 기준
  - [ ] 목록: 신고일, 설명 첫 줄, 기간, 상태, 후보 수, 접수 경로
  - [ ] 대리 신고 한 화면 양식, 완료 후 링크 복사
- 참고: `03-screens.md` A-07

---

## E3. 매칭

### FL-030 · 점수 함수
- P0 · 1.5h · 의존 FL-001
- 범위: `src/lib/matching/score.ts`, `score.test.ts`
- 수용 기준
  - [ ] `05-ai-matching.md` §5-3 시그니처
  - [ ] §5-1 표의 모든 칸 테스트, 제외 규칙 테스트
  - [ ] 예시 입력 → 0.922 테스트
  - [ ] 설정값(가중치, 임계값, COS 구간)은 인자로 주입 가능
- 참고: `05-ai-matching.md` §5

### FL-031 · 매칭 실행
- P0 · 2h · 의존 FL-022, FL-030
- 범위: `src/lib/matching/run.ts`
- 수용 기준
  - [ ] `matchForReport(reportId)`, `matchForItem(itemId)` — RPC 호출 → 점수 → 저장
  - [ ] §6 저장 규칙 전부 (upsert, `suggested`만 갱신, dismissed 재생성 금지, 상위 5개)
  - [ ] 같은 함수를 두 번 실행해도 결과 동일 (테스트)
  - [ ] 알림 대상(새로 0.70 이상) 목록 반환
- 참고: `05-ai-matching.md` §6

### FL-032 · 백그라운드 연결과 실패 처리
- P0 · 1h · 의존 FL-031
- 범위: `processReport`, `processItem`, `retryAnalysis`
- 수용 기준
  - [ ] 신고·습득물 저장 후 `after()`로 실행
  - [ ] 단계별 실패 시 `ai_status = failed`, 이후 단계 계속
  - [ ] A-05·A-07에 실패 표시 + [다시 분석]
  - [ ] 신고 후 30초 안에 P-04에 결과 반영
- 참고: `04-architecture.md` §7, `02-user-flows.md` §10

### FL-033 · 관리자 화면에 후보 표시
- P0 · 1h · 의존 FL-031, FL-014
- 수용 기준
  - [ ] A-05 매칭 후보 섹션 (신고 요약, 유사도, 상태), 누르면 신고 서랍
  - [ ] 목록의 "후보 n" 배지
- 참고: `03-screens.md` A-05

### FL-034 · 후보 숨김, 신고 취소
- P0 · 1h · 의존 FL-023
- 범위: `dismissCandidate`, `cancelReport`
- 수용 기준
  - [ ] 토큰 소유 확인 후 처리
  - [ ] 숨긴 후보는 재매칭해도 다시 안 나타남
  - [ ] 취소 시 신고 `closed`, 후보 `dismissed (report_closed)`
- 참고: `02-user-flows.md` §5, §9

---

## E4. 소유권 확인·반환

### FL-040 · 소유권 확인 요청 (분실자)
- P0 · 1.5h · 의존 FL-023
- 범위: `src/app/(public)/r/[token]/claim/[candidateId]/`, `submitClaim`
- 수용 기준
  - [ ] P-05 질문 필수, 사진 첨부 선택 (`claim-photos` 버킷)
  - [ ] 진행 중 요청이 있으면 거부 + 안내 문구
  - [ ] 후보·습득물·신고 상태 `claimed`, 이벤트 `claimed`
- 참고: `03-screens.md` P-05, `02-user-flows.md` §5

### FL-041 · 소유권 검토 (관리자) ★
- P0 · 2h · 의존 FL-040
- 범위: `src/app/admin/claims/`, `reviewClaim`
- 수용 기준
  - [ ] 목록 + 2열 비교 상세 (`03-screens.md` A-06)
  - [ ] 같은 습득물의 다른 요청 경고
  - [ ] 승인: 수령 안내 입력, 후보 `approved` / 거절: 내부 메모, 상태 복귀 (§9 다이어그램대로)
  - [ ] 거절 사유가 분실자 화면에 노출되지 않음
- 참고: `02-user-flows.md` §6

### FL-042 · 반환 처리
- P0 · 1h · 의존 FL-041
- 범위: A-09 모달, `markReturned` (`mark_returned` RPC)
- 수용 기준
  - [ ] 수령인 이름 필수, 확인 방법, 메모
  - [ ] 신고 연결 / 신고 없이 반환 둘 다 가능
  - [ ] 습득물 `returned`, 신고 `resolved`, 다른 후보 `dismissed (item_returned)` — 한 트랜잭션
- 참고: `03-screens.md` A-09

### FL-043 · 이관·폐기 처리
- P0 · 0.5h · 의존 FL-014
- 수용 기준
  - [ ] 확인 대화상자, 상태 변경, 관련 후보 `dismissed`, 이벤트
- 참고: `04-architecture.md` §6-1 `setFoundItemStatus`

---

## E5. 알림

### FL-050 · 이메일 ✂️
- P0 · 1.5h · 의존 FL-031, FL-041
- 범위: `src/lib/notify/`
- 수용 기준
  - [ ] 3종 템플릿 (`04-architecture.md` §8)
  - [ ] 본문에 공개 설명만, 사진·비공개 특징·점수 없음
  - [ ] 신고당 24시간 최대 3통
  - [ ] 발송 실패해도 매칭·승인 처리는 성공
- 참고: `04-architecture.md` §8

---

## E6. 대시보드

### FL-060 · KPI와 할 일
- P0 · 1h · 의존 FL-042
- 수용 기준
  - [ ] KPI 4개 (`01-prd.md` F8-1, 반환율 정의대로)
  - [ ] 할 일: 확인 요청 대기, 이관 기한 3일 이내
  - [ ] [+ 습득물 등록] 버튼 (모바일 하단 고정)
- 참고: `03-screens.md` A-02

### FL-061 · 주간 차트 ✂️
- P0 · 1h · 의존 FL-060
- 수용 기준: 최근 7일 습득·반환 막대 차트

---

## E7. 시설 설정·QR

### FL-070 · 시설 설정과 QR PNG
- P0 · 1.5h · 의존 FL-003
- 범위: `src/app/admin/settings/`, `src/app/api/qr/[slug]/route.ts`
- 수용 기준
  - [ ] 시설 정보·구역 목록·보관 기한 수정 (owner만)
  - [ ] QR 미리보기 + PNG 내려받기 (주소 `NEXT_PUBLIC_APP_URL/f/{slug}`)
- 참고: `03-screens.md` A-08

### FL-071 · QR 포스터 PDF ✂️
- P0 · 1h · 의존 FL-070
- 수용 기준: A4 포스터 (시설명, QR, 안내 문구 2줄)

---

## E8. 평가·지표

### FL-080 · 평가 데이터
- P0 · 1h (+ 팀 수집 시간) · 의존 없음
- 범위: `eval/cases.json`, `eval/photos/`, `eval/README.md`
- 수용 기준
  - [ ] `05-ai-matching.md` §7-1 수집 절차를 팀원용으로 한 장 정리
  - [ ] 습득물 30개 이상, 미끼 신고 10건, 비슷한 물건 묶음 4개 이상
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
  - [ ] 사용성 테스트 결과를 같은 형식으로 기록하는 표 (`eval/usability.md`)
- 참고: `01-prd.md` §7, `04-architecture.md` §10

---

## P1 (해커톤 이후)

| ID | 내용 | 참고 |
|---|---|---|
| FL-090 | 다국어 신고 (EN/JA/ZH): `messages/*.json`, 언어 선택 | PRD §4 P1 |
| FL-091 | LLM 재순위 | `05-ai-matching.md` §9 |
| FL-092 | 같은 지역 여러 시설 통합 매칭 | ADR-010 |
| FL-093 | 이관 기한 알림 (이메일) | PRD F9 |
| FL-094 | 종료 30일 후 연락처 자동 삭제 (Vercel Cron) | `04-architecture.md` §6-4 |
| FL-095 | 분실자 요청 수 제한 | `04-architecture.md` §9-1 |
| FL-096 | 신고 링크 이메일 재발송 | `02-user-flows.md` §10 |
| FL-097 | 택배 반환 안내·기록 (관광객용) | `00-plan.md` §7 Phase 2 |
| FL-098 | Playwright E2E: 등록 → 신고 → 확인 요청 → 반환 | `CLAUDE.md` §3 |
| FL-099 | 관리자 초대·회원가입 | Q7 |
