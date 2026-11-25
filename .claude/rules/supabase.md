---
paths:
  - "supabase/**"
  - "src/lib/supabase/**"
---

# Supabase 규칙

기준 문서: `docs/04-architecture.md` §4, §5. 스키마를 바꿀 때는 `supabase-migration` 스킬 절차를 따른다.

- 스키마 변경은 `supabase migration new <이름>`으로 만든 **새 파일**로만 한다. 커밋된 마이그레이션은 수정하지 않는다 (훅이 막는다).
- 모든 테이블에 RLS를 켠다. 새 테이블을 만들면 같은 마이그레이션에 정책도 넣는다.
- 관리자 정책은 `is_facility_member(facility_id)` 패턴을 쓴다. 새 테이블에도 `facility_id`를 둔다.
- anon 역할에는 정책을 만들지 않는다 (ADR-004).
- enum 값은 `docs/02-user-flows.md` §9 상태 다이어그램과 같아야 한다. 다르면 문서를 먼저 고친다.
- 날짜 비교는 한국 시간: `(col at time zone 'Asia/Seoul')::date`.
- 임베딩 컬럼 차원(1536)을 바꾸지 않는다. 바꾸려면 ADR-008을 갱신하고 전체 재임베딩 계획을 세운다.
- 스키마를 바꾼 뒤 `pnpm db:types`로 `src/lib/supabase/types.ts`를 다시 만든다. 이 파일은 손으로 고치지 않는다.
- `lib/supabase/admin.ts`(service role)는 서버 전용. 브라우저 코드에서 import하면 안 된다.
- `supabase db push`는 사람이 승인한 뒤에만 실행한다.
