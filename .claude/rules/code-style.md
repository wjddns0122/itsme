---
paths:
  - "src/**/*.{ts,tsx}"
---

# 코드 스타일

- TypeScript strict. `any` 금지. 모르면 `unknown` 후 zod로 좁힌다.
- 이름: 파일은 kebab-case (`photo-capture.tsx`), 컴포넌트는 PascalCase, 함수·변수는 camelCase, DB 컬럼은 snake_case 그대로.
- export: Next.js가 요구하는 곳(page, layout, route 등)만 default export. 나머지는 named export.
- 함수는 한 가지 일만. 50줄을 넘으면 나눌 수 있는지 본다.
- 매직 넘버 금지. 임계값·가중치는 환경변수나 `lib/matching/config.ts` 같은 설정에서 가져온다.
- 서버 전용 모듈(`lib/supabase/admin.ts`, `lib/ai/*`, `lib/notify/*`)은 첫 줄에 `import 'server-only'`.
- `'use client'`는 상호작용이 필요한 가장 작은 컴포넌트에만 붙인다.
- zod 스키마는 `lib/validation/`에 두고 폼·Server Action·AI 출력에서 같이 쓴다. 타입은 `z.infer`로 만든다.
- 주석은 "왜"만 적는다. 문서 근거가 있으면 `// docs/05-ai-matching.md §5` 처럼 위치를 남긴다.
- 사용하지 않는 코드, 주석 처리한 코드는 남기지 않는다.
