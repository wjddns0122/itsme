---
paths:
  - "**/*.test.ts"
  - "src/lib/**"
  - "eval/**"
---

# 테스트 규칙

- 도구: Vitest. 테스트 파일은 대상 옆에 `*.test.ts`로 둔다.
- 순수 함수(`lib/matching/score.ts`, `buildSearchText`, 마스킹, 후처리)는 모든 분기를 테스트한다.
- 버그를 고칠 때는 먼저 실패하는 테스트를 쓰고, 고친 뒤 통과를 확인한다.
- 단위 테스트에서 실제 외부 API(Claude, OpenAI, Supabase, Resend)를 부르지 않는다. 클라이언트를 mock한다.
- 실제 API를 부르는 곳은 `eval/`(매칭 평가)뿐이다. `pnpm eval`은 비용이 드니 사람이 요청할 때만 돌린다.
- 분실자 응답 함수(`getReportView` 등)는 허용 필드 밖의 값(`private_features`, `photo_paths`, `score`)이 없다는 테스트를 꼭 둔다.
- 테스트 이름은 동작을 설명한다: `it("민감 물품이면 카드번호를 마스킹한다")`.
- 완료 전 `pnpm check` (typecheck + lint + test) 통과.
