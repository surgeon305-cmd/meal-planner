# 주간 식단 추천 앱 — 계획서 (PLAN)

> 최종 갱신: 2026-06-30
> 이 문서는 "무엇을/왜" 만드는지를 다룬다. "어떻게(규칙·스키마)"는 [RULES.md](./RULES.md) 참고.

## 1. 한 줄 정의
날짜별(점심·저녁) 식단을 추천하고, 메뉴를 누르면 레시피와 필요한 재료를 보여주며,
재료를 모아 카테고리별 장바구니(체크리스트 + 검색 링크)로 정리해 주는 PWA.
혼자 또는 **이름 붙인 공유 식단**(가족/룸메 등)으로 함께 운영한다.

## 2. 핵심 사용자 시나리오
1. 로그인한다(이메일 또는 구글).
2. 홈은 **오늘 하루치**(점심/저녁)를 보여준다. **◀/▶**로 전날·다음날 이동, **📅 달력**으로 날짜 점프.
3. 각 끼니에 **5개 선지**(집밥 4 + 외식 1). 한·중·일·양+외식이 섞이되 **전날 먹은 요리종류는 제외**.
4. 마음에 안 들면 **갱신**으로 새 5선지. 원하는 메뉴가 없으면 **＋검색**으로 시드에서 찾거나 **AI로 새로 생성**.
5. 카드를 고른 뒤 **"확정" 버튼**으로 저장(→ 영구 저장). 확정 후 **수정/확정 취소** 가능. 거른 끼니는 빈칸.
6. 메뉴를 누르면 **레시피 상세**(조리 단계 + 인분 스케일된 재료). 좋아요/싫어요로 취향 반영.
7. **장바구니**에서 확정 식단 재료가 합산·중복 제거되어 카테고리별 체크리스트 + 검색 링크로.
8. **히스토리**에서 주 단위로 지난 식단을 돌아본다. **달력엔 확정한 날이 초록**.
9. 앱은 좋아요/싫어요·알레르기·비선호를 학습해 추천을 좁힌다.
10. **공유 식단**: "가족 식단" 등을 만들어 **공유 코드**로 초대, 멤버끼리 같은 식단을 함께 편집.

## 3. 기술 스택 (확정)
| 레이어 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 | React + Vite + TypeScript, PWA | Windows에서 즉시 개발/테스트, 폰 홈화면 설치 |
| 스타일 | **Tailwind CSS** | 확정 |
| 상태관리 | React Query(서버상태) + 가벼운 클라이언트 상태 | |
| 백엔드 | Supabase | Auth + Postgres + Edge Functions |
| 인증 | Supabase Auth (이메일+비밀번호 · 구글 OAuth) | 구글은 OAuth 클라이언트 설정 필요 |
| AI | Claude API · 기본 **`claude-opus-4-8`** | **Edge Function 안에서만 호출** (키 보호). 5선지 + single 모드 |
| 추천 출처 | **시드 풀 120개 우선** + AI 보충 | 일상은 시드, AI는 '추가 생성'·부족 시 |
| 저장 | 취향=localStorage / 식단=Supabase | 학습·variant는 localStorage, 엔트리는 DB |
| 배포 | 프론트: Vercel/Netlify · 백엔드: Supabase 클라우드 | |

## 4. 시스템 구성 (데이터 흐름)
```
[브라우저(PWA)]
   │  선지: seedPool(코드 내장) + recommend.ts(쿨다운·취향·하드필터)
   │  '추가 생성'만 ↓
   ▼
[Supabase Edge Function: generate-menus]  (mode:'single' = 단일 메뉴 / 기본 = 5선지+캐시)
   │  Claude 호출 → R2 검증 → (5선지 모드는 menu_cache 저장)
   ▼
[Postgres]  plans / plan_members / meal_entries(plan_id) / preference_profiles
            / menu_cache / shopping_checks
```
- Claude API 키는 Edge Function 환경변수에만. 프론트 노출 금지.

## 5. 데이터 모델 (상세는 RULES R8/R10 · 0001_init.sql · 0002_sharing.sql)
**날짜 기반 + 공유 식단** — 엔트리는 날짜별이며 **활성 식단(plan)에 귀속**.
- `plans` — 식단(개인 "내 식단" / 공유). name, owner, kind, **share_code** (R10)
- `plan_members` — 식단 멤버(owner/member), 공유 코드로 참여
- `meal_entries` — **(plan_id, 날짜, 끼니) 확정 한 끼.** 핵심 테이블. upsert, 거른 끼니는 행 없음
- `preference_profiles` — 취향 미러(주 출처는 localStorage `prefs:v1`, R3)
- `menu_cache` — AI 5선지 보충분 캐시(시드 부족 시)
- `shopping_checks` — 장바구니 체크 유지(현재는 localStorage)
- **시드 풀** `shared/seed/` — 120개 기본 레시피(R9), 선지·갱신의 1차 출처(코드 내장)
- RLS: `security definer` `is_plan_member`로 멤버만 접근(R10-5)

## 6. 화면 / 주요 컴포넌트
1. **로그인** — 이메일+비밀번호 토글, 구글 버튼(R8-1)
2. **식단(홈)** `WeekPlanScreen` — 하루치 + ◀/▶ + 📅 달력(`CalendarMonth`, 확정일 초록). 끼니별 5선지 + 갱신 + **＋검색**(`MenuSearchModal`) + **확정/수정/확정취소**(R8-3)
3. **히스토리** `HistoryScreen` — 주 단위 누적 조회(R8-5)
4. **메뉴 상세** `MenuDetailScreen` — 조리 단계 + 인분 스케일 재료 + 좋아요/싫어요(R3/R5)
5. **장바구니** `ShoppingListScreen` — 확정 엔트리 재료 합산 + 검색 링크 + 기본양념 접기(R4)
6. **설정** `SettingsScreen` — 알레르기·비선호 재료·인분 수·학습 초기화·로그아웃
- 공통: `ScreenShell` 상단 **`PlanSwitcher`**(식단 전환) + **`ShareSheet`**(만들기/참여/관리), 하단 `BottomNav`(식단/장바구니/히스토리/설정)

## 7. 로드맵 / 진행 현황 (2026-06-30)
### 완료 ✅
- 스캐폴드(React+Vite+TS+Tailwind+PWA), Supabase Auth(이메일+구글코드), DB(0001/0002)
- 시드 풀 120개 + `recommend.ts`(쿨다운·다양성·취향 하드필터/가중치)
- 날짜 기반 홈(하루치+◀▶+달력+확정/수정/취소), 메뉴 상세, 장바구니, 히스토리
- 영구 저장(Supabase `meal_entries`, 활성 식단 스코프)
- 취향 학습(좋아요/싫어요·알레르기·비선호 → 추천 반영), 인분 수 재료 스케일
- AI 메뉴 검색/추가(＋버튼, single 모드), 식단 공유(plans/멤버/공유코드), PWA 아이콘

### 사용자 액션 필요 ⚠️
- **`0002_sharing.sql` 적용**(미적용 시 런타임 에러) — Supabase SQL Editor
- AI '추가 생성' 활성화: `generate-menus` 배포 + `ANTHROPIC_API_KEY` 시크릿
- 구글 로그인: Google Cloud OAuth 클라이언트 + Supabase provider 설정

### 다음 후보
- select/skip 학습 신호 연동(R3 ⏳), 장바구니 체크 DB화(`shopping_checks`)
- 번들 코드 스플리팅(현재 ~630KB), 오프라인 다듬기, 실시간 공유 동기화

## 8. 확정 / 미해결
**확정됨 (2026-06-29):**
- 스타일링: Tailwind CSS
- Claude 기본 모델: `claude-opus-4-8` (품질 우선, 캐싱으로 비용 완화)
- 인분 수: 고정 기본값 없음 — 사용자가 설정/메뉴에서 매번 선택 (RULES R5)
- 쿨다운: 하루 단위 + 같은 날 점심→저녁, 외식 예외 (RULES R1-4)

**확정됨 (2026-06-29, 2차 피드백):**
- 모델: 고정 주간 그리드 → **날짜 기반**(오늘부터, 거른 날 제외, 주 단위 누적) — RULES R8
- 저장: **Supabase 계정 기반**(localStorage 아님). 선택 즉시 영구 저장 → 화면이동 초기화 문제 해결
- 레시피: **하이브리드** — 시드 풀 120개(한30·중25·일25·양25·외식15) 우선, AI는 보충 — RULES R9
- horizon: 오늘 + 향후 13일(2주) 롤링

**확정됨 (2026-06-30, 3차 — 기능 확장):**
- 홈을 **하루치 단일 뷰**(◀/▶) + **달력 전환**으로, 선택은 **확정 버튼**으로 분리 (RULES R8)
- **취향 학습 실제 반영** + **인분 수 재료 스케일** (RULES R3/R5)
- **AI 메뉴 검색/추가**(＋버튼) (RULES R11), **식단 공유**(공유 코드) (RULES R10)
- 인증: 이메일 + **구글 OAuth** 추가

**추후 검토:**
- 검색 링크 서비스 우선순위 — 기본 셋 다 노출
- 쿨다운 정책 과한지 재검토 · 시드 풀 확장(120→)
- 학습 select/skip 신호, 장바구니 체크 DB화, 번들 코드 스플리팅, 실시간 공유
