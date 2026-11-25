---
name: supabase-migration
description: FindLink DB 스키마를 바꿀 때 쓴다 (테이블·컬럼·enum·인덱스·RLS 정책·DB 함수 추가나 변경). 마이그레이션 파일 생성부터 RLS 점검, 타입 재생성, 문서 동기화까지의 절차.
---

# Supabase 마이그레이션 절차

## 1. 준비
- `docs/04-architecture.md` §4·§5와 `docs/02-user-flows.md` §9를 읽는다.
- 상태(enum) 값을 바꾸는 변경이면 **문서를 먼저** 고친다.

## 2. 파일 만들기
```bash
supabase migration new <짧은_영문_이름>
```
- 만들어진 새 파일에만 SQL을 쓴다. 커밋된 마이그레이션은 고치지 않는다.
- 하나의 마이그레이션 = 하나의 목적.

## 3. SQL 점검표
- [ ] 새 테이블에 `facility_id uuid not null references facilities(id)`가 있다
- [ ] `alter table ... enable row level security;`
- [ ] 관리자 정책은 `is_facility_member(facility_id)` 패턴
- [ ] anon 정책 없음
- [ ] 자주 거르는 컬럼(`facility_id`, `status`, 날짜)에 인덱스
- [ ] 날짜 비교는 `at time zone 'Asia/Seoul'`
- [ ] `security definer` 함수에는 `set search_path = public`
- [ ] 기존 데이터가 있을 때도 깨지지 않는다 (`not null` 추가 시 기본값 또는 백필)

## 4. 적용
- 원격 적용(`supabase db push`)은 **사람에게 확인받고** 실행한다.
- 적용 후 `pnpm db:types`로 타입을 다시 만든다.

## 5. 확인
- 다른 시설 관리자 계정으로 새 테이블을 조회해 0건인지 확인한다 (RLS).
- `pnpm check` 통과.

## 6. 문서
- `docs/04-architecture.md` §4 스키마·§5 정책을 실제 SQL에 맞춘다.
- 결정이 바뀌었으면 `docs/07-decisions.md`에 ADR 추가.
