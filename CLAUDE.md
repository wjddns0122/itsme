@AGENTS.md

# CLAUDE.md — 잇츠미 개발 규칙

AI 코딩 에이전트(Claude Code 등)가 이 저장소에서 작업할 때 따르는 규칙이다.
위의 `AGENTS.md`는 Next.js가 관리하는 파일이다 (`next dev`가 다시 써넣는다). 직접 고치지 않는다.
경로별 세부 규칙은 `.claude/rules/`에 있고, 해당 파일을 읽거나 고칠 때 자동으로 불러와진다.

## 1. 프로젝트 한 줄

시설 관리자가 습득물 사진을 찍으면 AI가 등록 양식을 채우고, 분실자가 자연어로 쓴 설명과 자동으로 비교해 후보를 추천하고, 관리자 승인을 거쳐 반환까지 관리하는 웹 서비스. 같은 분의 반복 문의를 묶어 관리자의 응대 부담을 줄이는 것도 핵심이다.

## 2. 작업 전에 읽을 문서

추측으로 채우지 말고 해당 문서를 먼저 읽는다.

| 알고 싶은 것 | 문서 |
|---|---|
| 무엇을 만들고 무엇을 안 만드는지 | `docs/01-prd.md` §4 범위 |
| 화면 흐름, 상태 전이 | `docs/02-user-flows.md` |
| 화면 구성, 문구, 빈/로딩/에러 상태 | `docs/03-screens.md` |
| DB 스키마, RLS, 서버 액션 | `docs/04-architecture.md` |
| AI 프롬프트, 출력 스키마, 점수 계산 | `docs/05-ai-matching.md` |
| 지금 할 일과 완료 기준 | `docs/06-backlog.md` 의 티켓 ID |
| 왜 이렇게 정했는지 | `docs/07-decisions.md` |

## 3. 기술 스택

- **Next.js 16** (App Router, TypeScript strict, `cacheComponents` 켜짐). 분실자 화면 `src/app/(public)/`, 관리자 화면 `src/app/admin/`.
- **Tailwind CSS 4 + shadcn/ui** (`base-nova` 스타일, Base UI 기반)
- **Supabase**: Postgres + pgvector, Auth, Storage
- **AI**: Claude API (`@anthropic-ai/sdk`, 기본 모델 `claude-opus-5-5`) / 임베딩 OpenAI `text-embedding-3-small` 1536차원 (ADR-008, 임시)
- **검증** zod / **폼** react-hook-form / **이메일** Resend / **배포** Vercel
- **패키지 매니저** pnpm / **테스트** Vitest (단위), Playwright (E2E, P1)

아직 설치하지 않은 패키지는 해당 티켓에서 `pnpm add`로 추가한다 (사람 승인 필요).

## 4. 명령어

```bash
pnpm dev          # 개발 서버
pnpm build        # 프로덕션 빌드
pnpm check        # typecheck + lint + test (완료 전 필수)
pnpm typecheck    # next typegen && tsc --noEmit
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm db:types     # Supabase 타입 생성 → src/lib/supabase/types.ts (FL-002 이후)
pnpm eval         # 매칭 평가 (FL-081에서 추가, 실제 API 비용 발생)
supabase migration new <name>
```

## 5. 디렉터리 구조

```
src/
  app/
    (public)/              # 분실자 화면: 로그인 없음, 모바일 우선
      f/[slug]/            # 시설 QR 랜딩, 분실 신고
      r/[token]/           # 신고 현황, 매칭 후보, 소유권 확인 요청
    admin/                 # 시설 관리자 화면: 로그인 필요
    api/                   # 크론·QR 등 route handler (필요할 때만)
  components/ui/           # shadcn 컴포넌트 (직접 수정 최소화)
  components/              # 도메인 컴포넌트
  lib/
    ai/                    # AI 호출은 여기서만
    matching/              # score.ts (순수 함수), run.ts
    supabase/              # server.ts, client.ts, admin.ts (service role, 서버 전용), types.ts
    validation/            # zod 스키마
    notify/                # 이메일
  server/actions/          # Server Actions
messages/ko.json           # UI 문구
supabase/migrations/       # SQL 마이그레이션 (스키마 변경의 유일한 경로)
eval/                      # 매칭 평가 데이터와 스크립트
docs/                      # 기획·설계 문서 (기준 문서)
.claude/                   # Claude Code 설정 (§9)
```

## 6. 꼭 지킬 원칙

세부 규칙은 `.claude/rules/`. 여기에는 어느 파일을 고치든 지켜야 할 것만 둔다.

1. **AI는 소유권을 확정하지 않는다.** 반환 승인은 관리자 버튼뿐이다.
2. **분실자에게는 허용 필드만 보낸다** (`docs/04-architecture.md` §9-2). 습득물 사진, 비공개 특징, 점수 숫자, `contact_key`, 같은 연락처의 다른 신고 정보, AI 소유권 비교 결과(`ai_verdict`)는 절대 안 된다.
3. **분실자 데이터 접근은 서버에서만.** 브라우저에서 anon 키로 테이블에 접근하지 않는다.
4. **분실자 연락처는 LLM에 보내지 않는다.**
5. **AI가 실패해도 흐름은 계속된다.** 재시도 1회 → 수동 입력 또는 원문 처리.
6. **스키마 변경은 새 마이그레이션 파일로만.** 커밋된 마이그레이션은 고치지 않는다.
7. **비밀값은 코드·로그·커밋에 넣지 않는다.** 변수 이름만 `.env.example`에.
8. **문서가 기준이다.** 동작을 바꾸면 같은 변경에서 문서도 고친다. 문서에 없는 비즈니스 규칙은 지어내지 말고 `docs/07-decisions.md` 미결 질문에 추가한 뒤 물어본다.
9. **검색은 관대하게, 반환은 엄격하게.** 모르는 항목은 점수에서 빼고(불이익 없음), 반환은 확인 질문·관리자 승인·추가 증빙을 거친다.

## 7. 작업 방식

1. 티켓 하나 단위로 작업한다: `/ticket FL-xxx`. 범위 밖 수정은 제안만 한다.
2. 완료 전에 `pnpm check`를 통과시키고 수용 기준을 하나씩 체크해 보고한다.
3. 커밋은 사람이 요청할 때만. 메시지 형식 `FL-xxx: 무엇을 했는지`.
4. 브랜치 이름 `fl-xxx-짧은-설명`. `main`에 직접 push하지 않는다.
5. 다음은 사람에게 먼저 확인받는다: `pnpm add/remove`, `supabase db push`, `git push`, 실제 API 비용이 드는 `pnpm eval`.

## 8. 용어

| 한국어 | 코드 | 뜻 |
|---|---|---|
| 시설 | `facility` | QR과 관리의 단위 (스키장 안내데스크, 학생지원센터 등) |
| 구역 | `area` | 시설 안의 장소 (리프트 A, 3층 강의실) |
| 보관 위치 | `storage_location` | 물건이 실제로 있는 곳 (보관함 A-03) |
| 습득물 | `found_item` | 시설이 보관 중인 주운 물건 |
| 분실 신고 | `lost_report` | 분실자가 낸 신고 |
| 매칭 후보 | `match_candidate` | 신고와 습득물의 쌍, 점수 포함 |
| 소유권 확인 요청 | claim | 분실자가 "내 물건 같아요"라고 요청한 상태 (`match_candidates.status = 'claimed'`) |
| 신고 링크 | `access_token` | 분실자가 로그인 없이 신고 현황을 보는 비밀 링크 |
| 이관 | transfer | 경찰(LOST112)로 습득물을 넘기는 것 |
| 문의 기록 | `inquiry` | 전화·방문 문의를 남긴 기록 (누가, 언제, 어떤 채널로) |
| 연락처 키 | `contact_key` | 같은 분의 신고·문의를 묶는 정규화한 연락처. 분실자에게 절대 노출하지 않는다 |
| 확인 질문 | claim questions | 분류별로 고정된 소유권 확인 질문. 물건마다 바뀌지 않는다 |
| AI 비교 결과 | `ai_verdict` | 확인 답변과 비공개 특징의 항목별 비교. 관리자 전용 참고 자료 |

## 9. Claude Code 설정 구조

| 위치 | 역할 | git |
|---|---|---|
| `CLAUDE.md` | 이 파일. 프로젝트 전체 규칙 | 공유 |
| `CLAUDE.local.md` | 개인 메모·로컬 설정 | 제외 |
| `AGENTS.md` | Next.js가 관리하는 에이전트 안내 (이 파일 맨 위에서 불러옴) | 공유 |
| `.mcp.json` | 프로젝트 MCP: Supabase 읽기 전용 (`SUPABASE_PROJECT_REF` 환경변수 필요) | 공유 |
| `.claude/settings.json` | 권한(allow/ask/deny)과 훅 연결 | 공유 |
| `.claude/settings.local.json` | 개인 권한 설정 | 제외 |
| `.claude/rules/` | 경로별 규칙: `code-style`, `nextjs`, `server-actions`, `supabase`, `ai`, `ui`, `testing` | 공유 |
| `.claude/commands/` | `/ticket`, `/fix-issue`, `/review-diff`, `/sync-docs` | 공유 |
| `.claude/skills/` | `supabase-migration`, `prompt-change`, `deploy`(사람만 호출) | 공유 |
| `.claude/agents/` | `code-reviewer`, `security-auditor` | 공유 |
| `.claude/hooks/` | `validate-bash.sh`(위험한 셸 명령 차단), `protect-files.sh`(.env·lockfile·커밋된 마이그레이션 수정 차단) | 공유 |
