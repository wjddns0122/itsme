---
paths:
  - "src/app/**"
  - "src/server/**"
  - "src/proxy.ts"
  - "next.config.ts"
---

# Next.js 16 규칙

이 프로젝트는 Next.js 16이다. 학습 데이터의 Next.js와 다를 수 있다.

- API를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다 (`AGENTS.md` 참고). 추측해서 쓰지 않는다.
- `cacheComponents`가 켜져 있다. 요청마다 달라지는 데이터(cookies, 토큰 조회 등)를 읽는 컴포넌트의 경계와 캐시 지시어는 문서(`01-app/.../cacheComponents`, `use cache`)를 확인하고 쓴다.
- 미들웨어는 `proxy`라는 이름의 파일 규칙을 쓴다. Supabase 세션 갱신을 넣을 때 문서의 `proxy` 항목을 확인한다.
- Server Action 설정(`bodySizeLimit` 등)은 `next.config.ts`의 `experimental.serverActions` 아래에 있다.
- 응답 뒤 작업은 `import { after } from 'next/server'`.
- 페이지·레이아웃의 props 타입은 Next가 생성하는 `PageProps<'/경로'>`, `LayoutProps<'/경로'>`를 쓴다. 타입 생성: `pnpm typecheck`(내부에서 `next typegen`).
- 라우트 구조: 분실자 화면은 `src/app/(public)/`, 관리자 화면은 `src/app/admin/`. 화면 ID는 `docs/03-screens.md`를 따른다.
- 페이지 파일 첫 줄 주석에 화면 ID를 적는다. 예: `// P-03 분실 신고`
