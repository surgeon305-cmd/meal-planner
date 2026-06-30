# 주간 식단 추천 앱 — 규칙서 (RULES)

> 최종 갱신: 2026-06-30
> 이 문서는 매번 다시 결정하지 않기 위한 **고정 규칙**이다.
> 코드·프롬프트·스키마는 모두 이 문서를 단일 출처(source of truth)로 따른다.
> 규칙을 바꾸면 반드시 이 문서를 먼저 갱신한다.
> 규칙 목록: R0 용어 · R1 선지 · R2 메뉴스키마 · R3 학습 · R4 재료/장바구니 · R5 인분 · R6 Claude호출 · R7 컨벤션 · R8 날짜·저장·인증 · R9 시드풀 · R10 식단 공유 · R11 메뉴 검색/추가 · **R12 배포 & 업데이트**.

---

## R0. 용어 / 상수
- **끼니(meal)**: `lunch`(점심), `dinner`(저녁). 하루 2끼. 아침 없음.
- **날짜(date)**: ISO `YYYY-MM-DD`. 계획은 **오늘 날짜부터** 시작한다. 화면에 날짜+요일을 함께 표시.
- **주(week)**: 월요일 시작 7일. **누적 히스토리의 그룹 단위**. `dayIndex` 0~6(0=월)은 쿨다운 등 내부 계산용으로만 쓰고, 화면·저장은 **날짜 기준**이다.
- **엔트리(entry)**: (날짜, 끼니)에 **확정 저장된** 한 끼. 선택 안 한 (날짜, 끼니)는 엔트리가 **없다(자동 제외)**.
- **슬롯(slot)**: (날짜, meal) 후보를 고르는 칸. 끼니당 선지 5개.
- **요리종류(cuisine)** 코드 — 이 5개로 **고정**:
  | 코드 | 의미 |
  |---|---|
  | `KR` | 한식 |
  | `CN` | 중식 |
  | `JP` | 일식 |
  | `WS` | 양식 |
  | `DINEOUT` | 외식 |
- **선지(option)**: 한 슬롯에 제시되는 메뉴 후보. 슬롯당 **항상 정확히 5개**.

---

## R1. 선지 구성 규칙
1. 한 슬롯의 선지는 **항상 5개**.
2. 기본 구성: **집밥 4 + 외식 1**. (외식 선지는 매 슬롯 1개 포함을 기본값으로 한다.)
   - **식사 스타일 오버라이드**(설정, `preferences.ts` `diningStyle`): `home`=집밥5·외식0 / `balanced`=집밥4·외식1(기본) / `dineout`=집밥2·**외식3**. 합은 항상 5.
3. 5개 선지의 요리종류는 **최대한 다양**하게. 단, **매 슬롯에 한·중·일·양이 다 있을 필요는 없다.**
   - 같은 요리종류가 한 슬롯의 5선지 안에서 **2개를 넘지 않도록** 한다.
4. **제외 규칙(쿨다운)** — 날짜 기준:
   - **전날 단위**: 어떤 날짜의 엔트리(확정)에서 먹은 요리종류는 **바로 다음 날짜**의 선지에서 **제외**한다. (예: 어제 일식을 먹었으면 오늘 선지에 `JP` 없음). **전날 엔트리가 없으면(=거른 날) 쿨다운도 없다.**
   - **같은 날 끼니 간**: 점심에 선택(확정)한 요리종류는 같은 날 저녁 선지에서 **제외**한다.
   - `DINEOUT`(외식)은 쿨다운 대상에서 **제외하지 않는다** (외식은 매 끼 1선지 유지).
   - ⚠️ 제외는 "제시된" 것이 아니라 "**선택된(엔트리로 저장된)**" 요리종류 기준이다.
   - (열림: 이 정책이 과한지 사용 후 재검토. 현재 기본값으로 확정.)
5. **갱신(refresh)**: 같은 슬롯에 새 5선지를 보여준다.
   - 직전에 보여줬던 선지는 **다시 안 나오게** 제외한다.
   - 갱신은 우선 **시드 풀(R9)** 에서 다른 5선지를 뽑는다(매번 AI 호출하지 않음).
   - 갱신은 직전 5선지에 대한 **약한 비선호 신호(skip)** 로 학습에 기록한다(R3).
6. **취향 반영**: 선지 구성 시 사용자 가중치(R3)를 반영하되,
   **5개 중 1개는 "탐색(wildcard) 선지"** 로 남겨 필터버블을 방지한다.
7. **선지 출처(하이브리드)**: 선지는 **우선 시드 레시피 풀(R9, 120+개)** 에서 위 규칙(다양성·쿨다운·취향·제외)에 맞게 골라 구성한다. 풀이 부족하거나 더 개인화가 필요할 때만 **AI 생성(R6)** 으로 보충한다.

---

## R2. 메뉴 JSON 스키마 (Claude 출력 계약)
Claude는 **반드시 아래 형태의 JSON 배열만** 출력한다. 백엔드는 이 스키마(zod)로 검증하고
실패 시 1회 재요청한다. 자연어 설명·코드펜스 금지.

```jsonc
// 집밥 메뉴 (type: "home")
{
  "id": "uuid",                 // 백엔드에서 부여 (Claude는 비워도 됨)
  "name": "제육볶음",
  "cuisine": "KR",              // KR | CN | JP | WS  (집밥은 DINEOUT 아님)
  "type": "home",
  "description": "한 줄 설명",
  "difficulty": "easy",         // easy | medium | hard
  "cookTimeMin": 25,
  "servings": 2,                // 기본 인분(설정값과 일치)
  "estimatedCalories": 650,     // 1인분 기준 추정치
  "tags": ["매콤", "돼지고기", "볶음"],
  "recipe": {
    "steps": ["1. ...", "2. ...", "3. ..."],
    "tips": ["..."]
  },
  "ingredients": [
    {
      "name": "돼지고기 앞다리살",
      "quantity": 300,
      "unit": "g",              // R4 단위 표 참고
      "category": "meat",       // R4 카테고리 표 참고
      "pantryStaple": false     // 기본 양념류 여부 (소금/간장/기름 등 true)
    }
  ]
}

// 외식 메뉴 (type: "dineout") — 레시피/재료 없음
{
  "name": "동네 초밥집 모둠초밥",
  "cuisine": "DINEOUT",
  "type": "dineout",
  "description": "가볍게 사먹기 좋은 점심",
  "tags": ["일식계열", "간편"],
  "searchKeyword": "초밥 맛집"   // 외부 검색용 키워드
}
```
규칙:
- 집밥 선지는 `type:"home"`, 외식 선지는 `type:"dineout"`.
- `cuisine`은 R0의 5코드만. 집밥은 `DINEOUT`을 쓰지 않는다.
- `ingredients[].name`은 **정규화 이전의 자연어 이름**이어도 된다(정규화는 R4가 담당).

---

## R3. 학습 규칙 (취향 프로파일)
저장소: **`src/lib/preferences.ts`** — **계정 동기화(Supabase `preference_profiles`가 단일 출처)**.
로그인 시 DB에서 **하이드레이트**해 모든 기기에 즉시 적용하고, 모든 변경은 **DB로 write-through**한다.
localStorage(`prefs:v1`)는 **오프라인 캐시**일 뿐(단일 출처 아님). 필드: `cuisineWeights`,
`tagWeights`, `dislikedMenuIds`, `dislikedIngredients`, `allergies`, **`last_servings`(인분, R5)**,
**`dining_style`(식사 스타일, R1-2)**.

### 신호와 점수
| 행동 | 이벤트 | 가중치 변화 | 구현 |
|---|---|---|---|
| 좋아요 | `like` | 해당 cuisine/tags **+5** | ✅ MenuDetail |
| 싫어요 | `dislike` | 해당 cuisine/tags **−5** + 메뉴 id 차단 | ✅ MenuDetail |
| 메뉴 선택(확정) | `select` | 해당 cuisine/tags **+3** | ✅ 확정 시 `recordSelection` |
| 갱신으로 사라진 선지 | `skip` | 해당 cuisine/tags **−1** | ⏳ 미연동 |

- 가중치는 **cuisine 단위**와 **tag 단위** 둘 다 누적한다.
- `dislike`한 **메뉴**(`dislikedMenuIds`)는 이후 추천에서 **하드 필터(완전 제외)**.
- **알레르기·비선호 재료**(설정)는 점수와 무관하게 **항상 하드 필터** — 집밥 재료명에 부분일치(대소문자 무시)하면 제외.

### 생성에 반영하는 법 (`buildSlotOptions` 내부, R1-6/R1-7)
- 하드 필터(차단 메뉴/알레르기/비선호 재료) 먼저 적용 → 남은 풀을 cuisine+tag 가중치로 **부드럽게 정렬**.
- **점진적 좁히기**: 표본이 쌓일수록 상위 취향 비중↑. 단 R1-6의 **탐색 선지 1개는 유지**.
- 학습은 설정에서 **초기화**(`resetLearning`) 가능.
- ⚠️ 차단 메뉴는 `disliked_menu_ids`(id 기반) 컬럼으로 DB에 함께 동기화한다. `shared/schema.ts`의 `PreferenceProfileSchema`는 `dislikedMenuNames`(이름 기반)도 보유 — 둘을 구분. 추후 통일 검토.

---

## R4. 재료 정규화 & 장바구니 합산 규칙
장바구니는 **활성 식단(R10)** 의 **확정 엔트리**(보이는 날짜 범위) 재료만 모은다. 인분 수 스케일(R5) 적용.

### 정규화
- 동의어 통합(예: `대파`=`파`, `다진 마늘`=`마늘`). 동의어 표는 코드에 `ingredientAliases`로 관리.
- 동일 (정규화명 + 단위) 항목은 **수량 합산**.
- 단위가 다르면(g vs 개) **합치지 않고 별도 항목**으로 둔다(임의 환산 금지).

### 카테고리 (코드 고정)
`vegetable`(채소) · `fruit`(과일) · `meat`(육류) · `seafood`(해산물) ·
`dairy`(유제품·계란) · `grain`(곡류·면·빵) · `seasoning`(양념·소스) · `etc`(기타)

### 단위 (코드 고정)
`g` · `kg` · `ml` · `L` · `개` · `장` · `쪽` · `대` · `컵` · `큰술` · `작은술` · `약간`
- `약간`은 수량 합산 불가 → "약간"으로 표기.

### 기본 양념(pantryStaple)
- 소금·설탕·간장·식용유·후추·다진마늘 등은 `pantryStaple:true`.
- 장바구니에서 **"기본 양념" 그룹으로 접어서** 별도 표시(집에 있을 가능성 높음).

### 검색 링크
- 각 항목에 외부 검색 딥링크를 붙인다. URL 템플릿은 코드 `searchLinks`에 관리.
  - 쿠팡: `https://www.coupang.com/np/search?q={정규화명}`
  - 마켓컬리: `https://www.kurly.com/search?sword={정규화명}`
  - 네이버쇼핑: `https://search.shopping.naver.com/search/all?query={정규화명}`
- 우선순위/노출 개수는 설정에서 조정(기본: 셋 다 노출).

---

## R5. 인분 수 / 수량 스케일  ✅ 구현
- **고정 기본 인분 수는 없다.** 사용자가 설정에서 인분 수를 선택한다. `preferences.ts`의 `getServings/useServings/setServings`로 관리하며, **계정 동기화**(R3) — `preference_profiles.last_servings` 컬럼이 단일 출처이고 모든 기기에 즉시 반영(localStorage는 오프라인 캐시).
- 시드 메뉴의 기본 `servings`는 **2**. 선택 인분 수가 다르면 재료 수량을 `선택/기본`으로 **비례 스케일**(소수 1자리 반올림).
- `약간`·`pantryStaple` 항목은 스케일하지 않는다.
- 적용 위치: `aggregate.ts`(장바구니 합산), `MenuDetailScreen`(레시피 재료 표시, "OO인분 기준"), `ShoppingListScreen`.

---

## R6. Claude 호출 규칙 (비용·안전)
0. **하이브리드 원칙**: 선지·갱신은 **시드 풀(R9) 우선**. AI는 시드로 채울 수 없을 때(쿨다운·제외로 부족, 강한 개인화 요청)만 보충한다. 일상 사용에서 AI 호출은 예외적이어야 한다.
1. Claude API는 **Supabase Edge Function 안에서만** 호출. 키는 환경변수.
2. **온디맨드 + 캐싱**: 시드로 부족할 때만, `menu_cache`를 제약 키(날짜버킷·끼니·제외요리·취향버킷)로 먼저 조회.
   캐시 히트면 호출하지 않는다. **캐시미스 때만** 호출.
3. 출력은 R2 스키마로 검증. 실패 시 **1회만** 재요청 후 그래도 실패면 폴백(캐시/기본 메뉴).
4. **기본 모델은 `claude-opus-4-8`** (품질 우선). 비용은 캐싱(R6-2)으로 완화.
   시스템 프롬프트에 R0·R1·R2 규칙을 박아 일관성 확보. 필요 시 일부 호출만 `claude-haiku-4-5`로 분기 가능.
5. 프롬프트는 `prompts/` 폴더에 버전관리. 변경 시 이 문서에 사유 기록.
6. **두 가지 모드** (`generate-menus` Edge Function):
   - 기본(`mode` 미지정): 슬롯당 **5선지** 생성 + `menu_cache` 캐싱.
   - **`mode:'single'`**: `requestedName`+`meal`로 **단일 메뉴 1개** 생성(R11 "추가 생성"용). R2 단일 객체로 검증, 1회 재시도. 단일 모드는 `ANTHROPIC_API_KEY`만 필요(캐시/서비스롤 불필요). **모델은 `claude-haiku-4-5`** — 정해진 스키마로 레시피 1개 생성은 단순해서 저렴·빠른 Haiku로 충분(비용 효율). 품질 부족 시 `claude-sonnet-4-6`로 상향 가능. (5선지 모드는 `claude-opus-4-8` 유지.)
7. 배포 필요: `supabase functions deploy generate-menus` + `supabase secrets set ANTHROPIC_API_KEY=...`. 미배포여도 시드 검색/추천은 동작(R11), AI 생성만 비활성.

---

## R7. 프로젝트 컨벤션
- 언어: **UI/레시피는 한국어**. 코드 식별자·커밋 메시지는 영어.
- 코드: TypeScript strict. 공유 타입은 `shared/types.ts`(zod 스키마에서 추론).
- cuisine/category/unit 등 **enum 값은 R0·R4 코드와 1:1**. 새 값 추가 시 이 문서 먼저 수정.
- 폴더:
  ```
  meal-planner/
    docs/            PLAN.md, RULES.md
    src/
      screens/       Login, WeekPlan(날짜 홈), MenuDetail, ShoppingList, History, Settings
      components/    BottomNav, ScreenShell, AppHeader, CuisineChip, MenuOptionCard,
                     CalendarMonth, MenuSearchModal, PlanSwitcher, ShareSheet, ChipInput
      lib/           auth, plannerStore, preferences(R3/R5), recommend(R1), dates,
                     aggregate(R4/R5), searchLinks, aiMenus(R11), plans(R10), supabaseClient
    supabase/
      functions/     generate-menus (5선지 + single 모드, Deno)
      migrations/    0001_init.sql, 0002_sharing.sql, 0003_prefs_sync.sql
    prompts/         Claude 프롬프트(버전관리)
    shared/          공유 타입/zod 스키마
      seed/          시드 레시피 풀 (R9): kr/cn/jp/ws/dineout + index
    scripts/         gen-icons.mjs (PWA 아이콘 생성, sharp --no-save)
    public/          favicon.svg, pwa-192/512, apple-touch-icon
  ```
- 규칙 변경 절차: **RULES.md 수정 → 타입/스키마 반영 → 코드 반영**. 역순 금지.

---

## R8. 날짜 기반 계획 · 저장 · 인증
1. **인증 필수**: Supabase Auth. **이메일+비밀번호**(`signUp`/`signInWithPassword`) + **구글 OAuth**(`signInWithOAuth`). 비로그인은 `/login`으로(`AuthGate`). 컨텍스트: `src/lib/auth.tsx`.
   - 구글 OAuth는 Google Cloud OAuth 클라이언트 + Supabase provider 설정이 있어야 동작(코드는 준비됨).
   - 이메일 즉시 가입 테스트하려면 Supabase에서 "Confirm email" OFF.
2. **날짜 기반 + 단일 날짜 뷰**: 홈은 **하루치**를 보여주고 **◀/▶**로 전날·다음날 이동, 상단 **📅 달력**(`CalendarMonth`)으로 날짜 점프(왔다 갔다 전환). 고정 월~일 그리드 아님.
   - **확정한 날짜는 달력에 초록**(둘 다=진한 초록, 하나=연한 초록).
   - 날짜 이동 범위 제한 없음(과거/미래 자유). "오늘로" 버튼 제공.
3. **확정 흐름(드래프트 → 확정)**: 선지에서 카드를 고르면 **드래프트(미저장)** 상태이고, **"확정" 버튼**을 눌러야 (날짜, 끼니) **엔트리로 영구 저장**된다. 확정 후 **수정 / 확정 취소** 가능. 화면 이동·새로고침에도 유지(Supabase 저장).
4. **거른 날 자동 제외**: 선택 안 한 (날짜, 끼니)는 엔트리가 없을 뿐 빈칸. 장바구니·히스토리·쿨다운은 **엔트리 있는 끼니만** 대상.
5. **주간 누적/히스토리**: 엔트리는 날짜로 쌓이며 **주(월요일 시작) 단위 그룹**으로 히스토리 화면(`HistoryScreen`)에서 조회.
6. **장바구니 범위**: 활성 식단(R10)의 확정 엔트리 재료를 R4대로 합산. 체크 상태는 **`shopping_checks` 테이블에 계정 저장**(`ShoppingListScreen`) — scope=활성 plan_id, item_key=`name__unit`. 기기 간·공유 식단 멤버 간 **Realtime 동기화**(localStorage `cart-checks:v1` 폐기).
7. **저장 위치**: 엔트리는 **`meal_entries` 테이블**에 저장되며 **활성 식단(`plan_id`)에 귀속**된다(R10). `plannerStore.tsx`가 활성 식단 기준으로 로드/upsert/delete. 갱신 variant는 localStorage(`planner-variant:v1`, 기기별).

---

## R9. 시드 레시피 풀
1. 앱은 **120개 이상의 기본 레시피**를 내장한다. 갱신·선지의 1차 출처(R1-7).
2. **균형(초기 목표)**: 한식 30 · 중식 25 · 일식 25 · 양식 25 · 외식 15 = **약 120개**.
3. 각 시드는 **R2/`SeedMenuSchema`**(=MenuOption + `id` 필수)를 따른다. `id`는 **안정적 슬러그**(예: `kr-jeyuk-bokkeum`). AI로 추가 생성된 메뉴(R11)는 `ai-<슬러그>` id를 받는다.
4. 위치: `shared/seed/{kr,cn,jp,ws,dineout}.ts` 각 파일이 `SeedMenu[]`(`krSeed` 등)을 export하고, `shared/seed/index.ts`가 `seedPool`로 합친다.
5. 카테고리·단위·pantryStaple은 R4 코드와 1:1. 재료명은 R4 동의어 정규화가 적용될 자연어로 둔다.
6. 시드는 점진적 확장 가능. 추가 시 균형과 `id` 유일성을 지킨다. (현재 정확히 120개)

---

## R10. 식단 공유 (shared plans)
여러 사용자가 이름 붙인 식단을 함께 편집한다. 저장소: `src/lib/plans.ts`(외부 스토어). DB: `0002_sharing.sql`.

1. **모델**:
   - `plans` (id, name, owner_id, **kind** `personal|shared`, **share_code** unique, created_at)
   - `plan_members` (plan_id, user_id, role `owner|member`, unique(plan_id,user_id))
   - `meal_entries.plan_id` — **엔트리는 사용자가 아니라 식단(plan)에 귀속**. unique(plan_id, entry_date, meal).
2. **개인 식단 자동 생성**: 로그인 시 `kind:'personal'` 식단("내 식단")이 없으면 생성하고 본인을 owner 멤버로. 기본 활성 식단 = 개인 식단. 활성 식단 id는 localStorage(`active-plan:v1`).
3. **공유 식단**: `createSharedPlan(name)` → 6자리 영문/숫자 `share_code` 발급(충돌 재시도). `joinByCode(code)` → 멤버로 참여 후 그 식단으로 전환. `leavePlan`, `renamePlan`(owner).
4. **활성 식단 전환**: `PlanSwitcher`(상단바, `ScreenShell`)에서 전환. 전환하면 `plannerStore`가 **해당 식단의 엔트리를 다시 로드**한다. 쿨다운·장바구니·히스토리는 모두 활성 식단 기준.
5. **RLS(재귀 방지)**: `security definer` 함수 `is_plan_member(plan_id)`로 정책 상호참조 재귀를 피한다. 코드로 참여는 `security definer` `join_plan_by_code(code)`(비멤버는 코드로 plan을 SELECT 못 하므로). 멤버만 plan/엔트리 접근, owner만 수정/삭제.
6. **API 불변**: `usePlanner()` 공개 인터페이스(`entries/getEntry/getVariant/confirmedCount/selectMenu/clearSelection/refreshSlot`)는 그대로. 내부만 활성 식단으로 스코프.
7. **실시간 공유 동기화** ✅: `plannerStore`가 Supabase Realtime `postgres_changes`를 `meal_entries`(필터 `plan_id=eq.<활성>`)에 구독해, 멤버가 식단을 바꾸면 다시 로드 → **실시간 공동 편집**. `meal_entries` 테이블이 `supabase_realtime` publication에 포함돼야 동작(0003 마이그레이션이 등록, R12).

---

## R11. 메뉴 검색 / 전체 보기 / 추가
슬롯 헤더 **☰ 전체 보기**(갱신 옆) 또는 선지 끝 **＋버튼** → `MenuSearchModal`. 자동 선지가 마음에 안 들 때 전체 풀에서 직접 고르거나 새로 만든다.

0. **요리종류 탭**: 전체 / 한 / 중 / 일 / 양 / 외식. 탭 선택 범위 안에서 목록·검색이 동작.
1. **전체 보기/검색**: 검색어 없으면 선택 탭의 **전체 시드 목록**(이름순), 입력하면 그 범위에서 퍼지 검색(이름/태그/설명). 고르면 슬롯에 확정(`selectMenu`). **AI/배포 없이 동작.**
2. **없으면 AI 생성 제안**: 일치가 없으면 "'<입력>'은(는) 없는 메뉴입니다. **추가 생성**할까요?" 제시. 누르면 `aiMenus.generateOneMenu(name,{meal})` → Edge Function `mode:'single'`(R6-6) 호출 → R2 검증된 메뉴를 받아 미리보기 후 확정. id는 `ai-<슬러그>`.
3. **우아한 실패**: Edge Function 미배포/에러여도 시드 검색은 정상. AI 생성만 친절한 에러로 비활성 안내.
4. 확정된 AI 메뉴는 엔트리에 **스냅샷으로 저장**되어 시드 풀에 없어도 상세/장바구니에서 그대로 보인다(MenuDetail은 seedPool→route state→엔트리 순으로 해석).

---

## R12. 배포 & 업데이트
1. **프론트 배포**: 정적 빌드(`npm run build` → `dist/`)를 Vercel/Netlify 등에 배포. 호스트 환경변수에 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 필요(공개 anon 키만). SPA 폴백(모든 경로 → `index.html`) 필요.
2. **Edge Function 배포**(AI 생성용): `supabase link --project-ref ozfvycvdlkiqbsxxjxdw` → `supabase functions deploy generate-menus` → `supabase secrets set ANTHROPIC_API_KEY=...`. 미배포여도 시드 검색/추천은 동작(R11).
3. **DB 마이그레이션**: `supabase/migrations/*.sql`을 순서대로 적용(SQL Editor 또는 `supabase db push`). 0001 → 0002 → 0003.
   - **`0003_prefs_sync.sql`**: `preference_profiles`에 `dining_style`·`disliked_menu_ids` 컬럼 추가, 그리고 `meal_entries`+`shopping_checks`를 `supabase_realtime` publication에 등록(R10-7 실시간 공유·R8-6 장바구니 체크 동기화 필수). 미적용 시 실시간/체크 동기화 동작 안 함.
4. **PWA 실시간 자동 업데이트** ✅: `registerType:'autoUpdate'` + `skipWaiting`/`clientsClaim`/`cleanupOutdatedCaches`. 등록은 `main.tsx`에서 직접 하고 **60초마다 `registration.update()`** 로 새 배포를 감지 → 새 SW 활성화 시 **자동 새로고침**. 사용자가 캐시 삭제/수동 업데이트할 필요 없다.
   - 상태는 Supabase/localStorage에 저장되므로 자동 새로고침에도 데이터 유지.
5. **배포 후 새 버전 반영 흐름**: 코드 푸시 → 호스트 재빌드/배포 → 열려 있는 PWA가 다음 업데이트 체크(≤60초)에 새 SW를 받아 자동 갱신.
