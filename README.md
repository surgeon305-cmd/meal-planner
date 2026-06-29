# 주간 식단 추천 (meal-planner)

7일치(점심·저녁) 식단을 추천하고, 레시피·재료를 정리해 한 주 장바구니로 모아 주는 개인용 PWA.

- 무엇/왜: [docs/PLAN.md](./docs/PLAN.md)
- 고정 규칙(단일 출처): [docs/RULES.md](./docs/RULES.md) — **코드/프롬프트/스키마는 이 문서를 따른다**

## 스택
React + Vite + TypeScript + Tailwind (PWA) · Supabase(Auth/Postgres/Edge Functions) · Claude API(`claude-opus-4-8`)

## 개발
```bash
npm install
cp .env.example .env   # Supabase 값 채우기
npm run dev
```

## 폴더
```
src/           React 앱 (screens, components, lib)
shared/        공유 zod 스키마 + 타입 (RULES R2)
supabase/
  migrations/  DB 스키마 (RULES R0/R3/R4)
  functions/   Edge Functions (generate-menus 등)
prompts/       Claude 프롬프트 (버전관리)
docs/          PLAN.md, RULES.md
```

## 규칙 변경 절차
RULES.md 수정 → shared 스키마/타입 반영 → 코드 반영. (역순 금지)
