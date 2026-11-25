---
paths:
  - "src/server/**"
  - "src/app/**/actions.ts"
  - "src/app/api/**"
---

# Server Action·API 규칙

기준 문서: `docs/04-architecture.md` §6, §9

## 형태
- 위치: `src/server/actions/<도메인>.ts` (`items`, `reports`, `candidates`, `facility`).
- 반환: `{ ok: true, data } | { ok: false, error: ErrorCode }`. 예외를 그대로 클라이언트에 던지지 않는다.
- `ErrorCode`: `invalid_input` | `unauthorized` | `not_found` | `conflict` | `rate_limited` | `ai_failed` | `internal`.
- 첫 줄에서 zod로 입력을 검증한다. 검증 전 값을 쓰지 않는다.

## 권한
- 관리자 액션: 로그인 사용자 Supabase 클라이언트를 쓴다 (RLS 적용). 시작할 때 로그인 여부를 확인한다.
- 분실자 액션(비로그인): service role을 쓰되 **반드시** `slug` 또는 `access_token`으로 대상 범위를 직접 제한한다.
- 분실자에게 돌려주는 객체는 `docs/04-architecture.md` §9-2 허용 필드로만 만든다. DB 행을 통째로 반환하지 않는다.
- 분실자 쓰기 요청은 honeypot 필드를 확인한다.

## 처리
- 느린 일(정규화, 임베딩, 매칭, 이메일)은 `after()`로 응답 뒤에 실행한다. 사진 분석만 예외.
- 여러 테이블 상태를 함께 바꾸는 처리(반환, 확인 요청 승인)는 DB 함수(RPC) 하나로 트랜잭션 처리한다.
- 상태 변경마다 `item_events`에 기록한다.
- 로그에 연락처, 토큰, API 키를 남기지 않는다.
