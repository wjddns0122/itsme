---
description: 코드와 docs/ 문서가 어긋난 곳을 찾아 문서를 맞춘다
---

코드와 문서가 어긋난 곳을 찾아서 맞춰.

확인할 짝:
| 코드 | 문서 |
|---|---|
| `supabase/migrations/*.sql` 의 enum, 테이블, 함수 | `docs/04-architecture.md` §4, `docs/02-user-flows.md` §9 |
| `src/server/actions/*.ts` 함수 목록 | `docs/04-architecture.md` §6 |
| `src/lib/ai/prompts.ts`, `src/lib/validation/ai.ts` | `docs/05-ai-matching.md` §2~4 |
| `src/lib/matching/score.ts`, 임계값 설정 | `docs/05-ai-matching.md` §5, §11 변경 기록 |
| `messages/ko.json` 문구 | `docs/03-screens.md` |
| `.env.example` | `docs/04-architecture.md` §3 |
| 끝난 티켓 | `docs/06-backlog.md` 의 `✅` 표시 |

1. 짝마다 차이를 표로 보여줘 (코드 기준 / 문서 기준 / 어느 쪽이 맞아 보이는지).
2. 코드가 맞는 경우만 문서를 고쳐. 문서가 맞아 보이면(코드가 문서를 어긴 경우) 고치지 말고 따로 알려줘.
3. 결정이 바뀐 것이면 `docs/07-decisions.md`에 ADR을 추가해.
