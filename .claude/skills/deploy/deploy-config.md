# 배포 환경 설정

## 환경

| 환경 | 주소 | 브랜치 | DB |
|---|---|---|---|
| 로컬 | `http://localhost:3000` | 작업 브랜치 | Supabase 원격 프로젝트 (MVP는 하나만 사용) |
| 미리보기 | Vercel Preview URL | PR 브랜치 | 같은 Supabase 프로젝트 |
| 프로덕션 | Vercel Production URL | `main` | 같은 Supabase 프로젝트 |

Phase 1(교내 파일럿)부터 Supabase를 개발용·운영용 두 프로젝트로 나눈다.

## 리전
- Supabase: 서울 `ap-northeast-2`
- Vercel 함수: 서울 `icn1`

## 브랜치 전략
- `main` = 프로덕션. 직접 push하지 않고 PR로 병합한다.
- 작업 브랜치 이름: `fl-xxx-짧은-설명` (예: `fl-011-photo-extract`)
- 승격 기준: PR 미리보기에서 `SKILL.md` §3 스모크 테스트 통과 + `pnpm check` 통과

## 환경변수 (Vercel에 등록)

| 변수 | 로컬 | 미리보기 | 프로덕션 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ |
| `GEMINI_API_KEY`, `GEMINI_TIER`, `VISION_MODEL`, `LLM_MODEL` | ✓ (무료 등급, 테스트 데이터만) | ✓ | ✓ (유료 등급) |
| `GEMINI_FREE_DEMO_UNTIL` | — | — | 해커톤 시연 기간만 (`2026-11-26`, ADR-025 예외). 유료 키가 생기면 지운다 |
| (Stage 2) `EMBEDDING_MODEL`, `EMBEDDING_DIM` | — | — | — |
| `MATCH_SAVE_THRESHOLD`, `MATCH_NOTIFY_THRESHOLD` | ✓ | ✓ | ✓ |
| `RESEND_API_KEY`, `EMAIL_FROM` | 선택 | ✓ | ✓ |
| `NEXT_PUBLIC_APP_URL` | localhost | 미리보기 주소 | 프로덕션 주소 |
| `SUPABASE_PROJECT_REF` | ✓ (MCP용) | — | — |

전체 목록과 뜻: `docs/04-architecture.md` §3, `.env.example`
