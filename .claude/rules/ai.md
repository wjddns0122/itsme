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
- 소유권 확인 질문은 분류별 고정이다. 비공개 특징을 보고 질문을 만들지 않는다 (`docs/05-ai-matching.md` §9-1).
- AI 답변 비교 결과(`ai_verdict`)는 관리자 전용 참고 자료다. 분실자 응답·이메일에 넣지 않고, 이 결과로 자동 승인하지 않는다.

## Gemini API
- 공식 SDK `@google/genai`만 쓴다 (`@google/generative-ai`는 쓰지 않음). 클라이언트는 `lib/ai/client.ts` 하나, 키는 `GEMINI_API_KEY`.
- 모델은 환경변수(`VISION_MODEL`, `LLM_MODEL`). 코드에 모델 ID를 하드코딩하지 않는다.
- 구조화 출력은 `responseMimeType: "application/json"` + `responseJsonSchema`(zod 스키마에서 생성). 받은 JSON은 다시 zod로 검증한다.
- `temperature`, `topP`, `topK`를 보내지 않는다 (Gemini 4·3.6+는 무시하고 이후 400 예정).
- 응답이 비었거나 `finishReason`이 `STOP`이 아니면 실패로 보고 1회 재시도.
- 호출마다 `{ kind, model, latency_ms, usageMetadata, finish_reason }`을 로그로 남긴다.
- **무료 등급 키로는 팀이 만든 테스트 데이터만** 보낸다. 무료 등급 입력은 구글 제품 개선에 쓰이고 사람이 볼 수 있다. 실제 분실자 정보·사진은 유료 등급 키로만 (ADR-025).
- SDK 사용법이 확실하지 않으면 추측하지 말고 Gemini API 문서를 확인한다.

## 매칭
- 점수 계산은 `lib/matching/score.ts`의 순수 함수. DB·네트워크 접근 금지. 모든 분기에 단위 테스트.
- 모르는 값(`null`, 빈 배열)은 0점이 아니라 계산에서 뺀다. 점수와 함께 `coverage`(정보 충족도)를 저장한다 (`docs/05-ai-matching.md` §5).
- 민감 물품 버튼으로 등록한 사진은 외부 AI로 보내지 않는다.
- AI 유사도 판정의 입력은 `buildSearchText`로 코드에서 만든 텍스트만 쓴다. 판정 결과의 `matched`·`conflicts`는 관리자 전용이다 (`docs/05-ai-matching.md` §5-4).
- 후보 저장은 upsert, `suggested`만 갱신, 사용자가 숨긴 후보는 다시 만들지 않는다 (`docs/05` §6).

## 실패 처리
- AI 실패로 등록·신고 흐름이 멈추면 안 된다. 1회 재시도 후 수동 입력 또는 원문 판정으로 넘어간다.
