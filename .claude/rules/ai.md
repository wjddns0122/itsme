---
paths:
  - "src/lib/ai/**"
  - "src/lib/matching/**"
  - "src/lib/validation/**"
  - "eval/**"
---

# AI·매칭 규칙

기준 문서: `docs/05-ai-matching.md`. 프롬프트·스키마·가중치·임계값을 바꿀 때는 `prompt-change` 스킬 절차를 따른다.

## 안전
- AI는 소유권을 확정하지 않는다. 반환 승인은 관리자 버튼뿐이다.
- `private_features`, 사진 경로, 점수 숫자는 분실자 응답·이메일에 넣지 않는다.
- 분실자 연락처(이름, 전화, 이메일)는 LLM 입력에 넣지 않는다.
- 민감 물품(카드, 신분증)은 `is_sensitive = true`로 강제하고 숫자열·이메일·전화번호를 마스킹한다.

## Claude API
- 공식 SDK `@anthropic-ai/sdk`만 쓴다. 클라이언트는 `lib/ai/client.ts` 하나.
- 모델은 환경변수(`VISION_MODEL`, `LLM_MODEL`). 코드에 모델 ID를 하드코딩하지 않는다.
- 구조화 출력은 structured outputs(`client.messages.parse()` + zod 또는 `output_config.format`). 정확한 헬퍼 이름은 SDK 문서로 확인한다.
- `claude-opus-5-5`에서 강제 `tool_choice`(`any`, `tool`)와 `temperature`/`top_p`/`top_k`는 400 에러다. 쓰지 않는다.
- thinking은 끌 수 없다. `output_config.effort`로 조절한다 (추출은 `low`부터).
- `stop_reason`을 먼저 본다. `refusal`이면 실패 처리, `max_tokens`면 1회 재시도.
- 서버 측 fallback(`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`)을 켠다.
- 호출마다 `{ kind, model, latency_ms, usage, stop_reason }`을 로그로 남긴다.

## 매칭
- 점수 계산은 `lib/matching/score.ts`의 순수 함수. DB·네트워크 접근 금지. 모든 분기에 단위 테스트.
- 임베딩 입력은 `buildSearchText`로 코드에서 만든 텍스트만 쓴다.
- 후보 저장은 upsert, `suggested`만 갱신, 사용자가 숨긴 후보는 다시 만들지 않는다 (`docs/05` §6).

## 실패 처리
- AI 실패로 등록·신고 흐름이 멈추면 안 된다. 1회 재시도 후 수동 입력 또는 원문 임베딩으로 넘어간다.
