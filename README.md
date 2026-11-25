# 잇츠미

> 잃어버린 물건과 주인을 AI로 다시 연결합니다.

사업계획서 초안의 가칭은 FindLink였다 (ADR-015). 코드의 영문 이름은 `itsme`.

학교·스키장·리조트·축제 같은 시설의 **습득물 관리 업무를 디지털화하는 B2B SaaS**와, 분실자가 앱 설치 없이 쓰는 **분실 신고 웹**으로 구성된다.
분실자는 무료, 시설이 구독료를 내는 B2B2C 구조.

포지셔닝 한 줄: **분실물은 찾아주고, 관리 업무는 줄여주는 AI SaaS.** 현장 인터뷰에서 확인한 가장 큰 불편은 반복 문의다 (ADR-016).

세 기둥: 빠른 등록 · 자동 탐색 · 안전한 반환. 설계 원칙: 검색은 관대하게, 반환은 엄격하게 (ADR-020).

포지셔닝: 장소 기반 AI 분실물 통합 탐색 및 시설 관리 SaaS. 시설 검색이 기본 입구이고 QR은 보조다 (ADR-026).

---

## 문서 지도

| 파일 | 내용 | 주 독자 |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | AI 코딩 에이전트 작업 규칙 | Claude Code 등 AI 에이전트 |
| [docs/00-plan.md](docs/00-plan.md) | 개발 계획, 3일 일정, 역할, 리스크, 이후 로드맵 | 팀 전체 |
| [docs/01-prd.md](docs/01-prd.md) | 제품 요구사항 (문제, 범위, 기능, 지표) | 팀 전체 |
| [docs/02-user-flows.md](docs/02-user-flows.md) | 사용자 흐름, 상태 다이어그램, 예외 케이스 | 디자이너, 개발 |
| [docs/03-screens.md](docs/03-screens.md) | 화면 목록과 화면별 구성·상태 | 디자이너, 개발 |
| [docs/04-architecture.md](docs/04-architecture.md) | 시스템 구조, DB 스키마, 서버 액션, 보안 | 개발 |
| [docs/05-ai-matching.md](docs/05-ai-matching.md) | AI 특징 추출, 매칭 점수, 평가 방법 | 개발 |
| [docs/06-backlog.md](docs/06-backlog.md) | 작업 티켓과 수용 기준 | 개발 (AI에 티켓 단위로 전달) |
| [docs/07-decisions.md](docs/07-decisions.md) | 결정 기록(ADR), 미결 질문 | PM |

## 읽는 순서

- **처음 합류한 팀원**: README → 01-prd → 02-user-flows
- **디자이너**: 01-prd §3~5 → 02-user-flows → 03-screens
- **개발 (사람 또는 AI)**: CLAUDE.md → 04-architecture → 05-ai-matching → 06-backlog의 티켓 하나

## 문서 규칙

1. 문서가 기준(SSOT)이다. 코드가 동작을 바꾸면 같은 커밋에서 문서도 고친다.
2. 결정이 바뀌면 `07-decisions.md`에 새 ADR을 추가한다. 기존 ADR은 지우지 않고 "대체됨"으로 표시한다.
3. 문서의 수치 목표는 **목표**다. 실측값은 "실측" 표시와 측정일, 표본 수를 함께 적는다.
4. 확인되지 않은 사실(법 조항, 시장 수치)은 `확인 필요` 표시를 붙인다.

---

## 시작하기 (개발)

필요: Node.js 24 이상, pnpm, Supabase CLI

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

`.env.local`에 키를 채운 뒤:

```bash
pnpm dev
```

- 분실자 화면: http://localhost:3000
- 관리자 화면: http://localhost:3000/admin
- 완료 전 점검: `pnpm check` (typecheck + lint + test)

## 저장소 구조

```
├── CLAUDE.md              # AI 에이전트 규칙 (AGENTS.md를 불러옴)
├── CLAUDE.local.md        # 개인 설정 (git 제외)
├── AGENTS.md              # Next.js가 관리하는 에이전트 안내
├── .mcp.json              # 프로젝트 MCP (Supabase 읽기 전용)
├── .claude/
│   ├── settings.json      # 권한·훅 (팀 공유)
│   ├── rules/             # 경로별 규칙 7개
│   ├── commands/          # /ticket /fix-issue /review-diff /sync-docs
│   ├── skills/            # supabase-migration, prompt-change, deploy
│   ├── agents/            # code-reviewer, security-auditor
│   └── hooks/             # validate-bash.sh, protect-files.sh
├── docs/                  # 기획·설계 문서 00~07
├── src/                   # Next.js 앱
├── supabase/migrations/   # DB 마이그레이션
├── eval/                  # 매칭 평가
└── messages/ko.json       # UI 문구
```

AI로 개발할 때는 Claude Code에서 `/ticket FL-002`처럼 티켓 단위로 시킨다. 자세한 규칙은 [CLAUDE.md](CLAUDE.md) §7, §9.
