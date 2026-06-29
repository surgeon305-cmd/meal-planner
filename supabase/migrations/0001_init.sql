-- =============================================================================
-- 0001_init.sql — 주간 식단 추천 앱 초기 스키마
-- 날짜 기반 모델(RULES R8) + 학습(R3) + 시드/AI 캐시(R6/R9) + 장바구니(R4).
-- 재실행 안전(idempotent): enum guard, IF NOT EXISTS, drop-then-create policy.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUMS (RULES R0/R2/R3/R4) — 고정 코드
-- ---------------------------------------------------------------------------
do $$ begin create type cuisine as enum ('KR','CN','JP','WS','DINEOUT'); exception when duplicate_object then null; end $$;
do $$ begin create type meal_type as enum ('lunch','dinner'); exception when duplicate_object then null; end $$;
do $$ begin create type menu_type as enum ('home','dineout'); exception when duplicate_object then null; end $$;
do $$ begin create type ingredient_category as enum ('vegetable','fruit','meat','seafood','dairy','grain','seasoning','etc'); exception when duplicate_object then null; end $$;
do $$ begin create type selection_action as enum ('select','like','skip','dislike'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- TABLE: preference_profiles (RULES R3 + R5) — 사용자당 1행
-- ---------------------------------------------------------------------------
create table if not exists public.preference_profiles (
  user_id              uuid        primary key references auth.users (id) on delete cascade,
  cuisine_weights      jsonb       not null default '{}',
  tag_weights          jsonb       not null default '{}',
  disliked_ingredients text[]      not null default '{}',
  disliked_menu_names  text[]      not null default '{}',
  allergies            text[]      not null default '{}',
  last_servings        int,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.preference_profiles is 'RULES R3 학습 가중치 + R5 마지막 인분 수. 사용자당 1행.';

-- ---------------------------------------------------------------------------
-- TABLE: meal_entries (RULES R8) — (날짜, 끼니)에 확정 저장된 한 끼.
-- 핵심 테이블: 선택하면 upsert, 안 한 끼니는 행 없음(자동 제외).
-- ---------------------------------------------------------------------------
create table if not exists public.meal_entries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  entry_date  date        not null,                          -- R8-2 날짜 기준
  meal        meal_type   not null,
  menu_id     text        not null,                          -- 시드 슬러그(R9) 또는 생성 id
  cuisine     cuisine     not null,                          -- R1-4 쿨다운 쿼리용
  menu        jsonb       not null,                          -- R2 메뉴 스냅샷(레시피+재료 포함)
  servings    int,                                           -- R5
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date, meal)                         -- 끼니당 1개 확정
);
comment on table public.meal_entries is 'RULES R8 날짜별 확정 식단. (user, date, meal) 유니크 upsert. 주 단위 누적 히스토리의 원천.';

-- ---------------------------------------------------------------------------
-- TABLE: selection_events (RULES R3) — 학습용 행동 로그
-- ---------------------------------------------------------------------------
create table if not exists public.selection_events (
  id         uuid             primary key default gen_random_uuid(),
  user_id    uuid             not null references auth.users (id) on delete cascade,
  menu_id    text,
  menu_name  text,
  cuisine    cuisine,
  tags       text[]           not null default '{}',
  action     selection_action not null,
  created_at timestamptz      not null default now()
);
comment on table public.selection_events is 'RULES R3 행동 로그(select/like/skip/dislike) → 가중치 갱신.';

-- ---------------------------------------------------------------------------
-- TABLE: menu_cache (RULES R6-2) — AI 생성 보충분 캐시(시드로 부족할 때만).
-- 공유 테이블: 클라이언트는 읽기만, 쓰기는 Edge Function service role.
-- ---------------------------------------------------------------------------
create table if not exists public.menu_cache (
  id                uuid        primary key default gen_random_uuid(),
  cache_key         text        not null,                    -- {dayBucket|meal|excluded|servings}
  day_index         int         not null check (day_index between 0 and 6),
  meal              meal_type   not null,
  excluded_cuisines text[]      not null default '{}',
  servings          int,
  payload           jsonb       not null,                    -- R2 옵션 배열
  hit_count         int         not null default 0,
  created_at        timestamptz not null default now()
);
comment on table public.menu_cache is 'RULES R6-2 AI 생성 메뉴 재사용 캐시. 공유(클라이언트 읽기 전용).';

-- ---------------------------------------------------------------------------
-- TABLE: shopping_checks (RULES R8-6 + R4) — 장바구니 체크 상태 유지
-- 장바구니 항목 자체는 meal_entries에서 파생(합산)하고, 체크 여부만 저장한다.
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_checks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  scope      text        not null,                           -- 주 시작일 'YYYY-MM-DD' 또는 범위 키
  item_key   text        not null,                           -- 정규화명 + '|' + 단위 (R4)
  checked    boolean     not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, scope, item_key)
);
comment on table public.shopping_checks is 'RULES R8-6 장바구니 체크 유지. 항목은 meal_entries에서 합산, 여기엔 체크 상태만.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index if not exists meal_entries_user_date_idx     on public.meal_entries (user_id, entry_date);
create index if not exists selection_events_user_id_idx   on public.selection_events (user_id);
create index if not exists shopping_checks_user_scope_idx on public.shopping_checks (user_id, scope);
create unique index if not exists menu_cache_cache_key_key on public.menu_cache (cache_key);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- 사용자 소유 테이블: user_id = auth.uid() 행만 접근. menu_cache는 공유 읽기.
-- ---------------------------------------------------------------------------
alter table public.preference_profiles enable row level security;
alter table public.meal_entries        enable row level security;
alter table public.selection_events    enable row level security;
alter table public.menu_cache          enable row level security;
alter table public.shopping_checks     enable row level security;

drop policy if exists preference_profiles_owner on public.preference_profiles;
create policy preference_profiles_owner on public.preference_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists meal_entries_owner on public.meal_entries;
create policy meal_entries_owner on public.meal_entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists selection_events_owner on public.selection_events;
create policy selection_events_owner on public.selection_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists shopping_checks_owner on public.shopping_checks;
create policy shopping_checks_owner on public.shopping_checks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- menu_cache: 인증 사용자 읽기만(쓰기는 service role이 RLS 우회).
drop policy if exists menu_cache_read on public.menu_cache;
create policy menu_cache_read on public.menu_cache
  for select to authenticated using (true);

-- =============================================================================
-- END 0001_init.sql
-- =============================================================================
