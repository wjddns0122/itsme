---
name: deploy
description: 잇츠미를 Vercel에 배포하기 전 점검과 배포 후 확인 절차. 사람이 /deploy로 부를 때만 쓴다.
disable-model-invocation: true
---

# 배포 절차

환경·브랜치·환경변수 표는 [deploy-config.md](deploy-config.md)를 본다.

## 1. 배포 전 점검
- [ ] `pnpm check` 통과
- [ ] `pnpm build` 통과
- [ ] 이번 변경에 마이그레이션이 있으면 원격 DB에 적용됐는지 확인 (`supabase migration list --linked`). 안 됐으면 사람에게 `supabase db push` 승인을 받는다.
- [ ] 새 환경변수가 있으면 `.env.example`에 있고, Vercel 프로젝트에도 등록됐는지 사람에게 확인한다.
- [ ] `docs/` 문서가 변경 내용과 맞다 (`/sync-docs`).

## 2. 배포
- 프로덕션 배포는 `main` 병합으로만 한다. `vercel --prod`는 쓰지 않는다 (훅이 막는다).
- PR을 열면 미리보기 배포가 생긴다. 미리보기 주소로 아래 확인을 먼저 한다.
- `git push`는 사람이 승인한 뒤에만.

## 3. 배포 후 확인 (스모크 테스트)
- [ ] `/f/{데모 시설 slug}` 시설 랜딩이 열린다 (P-02)
- [ ] 분실 신고를 1건 제출하면 `/r/{token}`으로 이동한다 (P-03 → P-04)
- [ ] `/admin/login` 로그인 (A-01)
- [ ] 습득물 사진 등록에서 AI가 양식을 채운다 (A-03)
- [ ] Vercel 함수 로그에 에러가 없다

## 4. 되돌리기
- Vercel 대시보드에서 직전 배포로 Promote (사람이 실행).
- 마이그레이션은 되돌리지 않는다. 고치는 새 마이그레이션을 만든다.
