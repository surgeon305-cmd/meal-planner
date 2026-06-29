-- =============================================================================
-- 0001_init.sql — Meal-planning PWA initial schema
-- Source of truth: docs/RULES.md (R0 constants/cuisine, R2 menu JSON, R3 learning,
--                   R4 categories & units) and docs/PLAN.md §5 data model.
-- Target: Supabase Postgres (uses auth.users, auth.uid(), gen_random_uuid()).
-- =============================================================================

-- gen_random_uuid() lives in pgcrypto on older Postgres; harmless if present.
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS  (RULES R0 cuisine codes, R0 meal types, R2 menu type, R4 categories,
--         R3 learning actions). Guarded so the migration re-runs cleanly.
-- =============================================================================

-- RULES R0: cuisine codes are FIXED to exactly these 5.
do $$ begin
  create type cuisine as enum ('KR', 'CN', 'JP', 'WS', 'DINEOUT');
exception when duplicate_object then null; end $$;

-- RULES R0: 하루 2끼 — lunch / dinner (no breakfast).
do $$ begin
  create type meal_type as enum ('lunch', 'dinner');
exception when duplicate_object then null; end $$;

-- RULES R2: menu option is either a home recipe or a dine-out suggestion.
do $$ begin
  create type menu_type as enum ('home', 'dineout');
exception when duplicate_object then null; end $$;

-- RULES R4: ingredient categories are FIXED (code-locked).
do $$ begin
  create type ingredient_category as enum
    ('vegetable', 'fruit', 'meat', 'seafood', 'dairy', 'grain', 'seasoning', 'etc');
exception when duplicate_object then null; end $$;

-- RULES R3: learning signals / actions.
do $$ begin
  create type selection_action as enum ('select', 'like', 'skip', 'dislike');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- TABLE: preference_profiles
-- RULES R3 (learning / taste profile) + R5 (last selected servings).
-- One row per user. Holds cuisine/tag weights and hard-filter lists.
-- =============================================================================
create table if not exists public.preference_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  cuisine_weights      jsonb        not null default '{}'::jsonb,  -- R3: per-cuisine weights
  tag_weights          jsonb        not null default '{}'::jsonb,  -- R3: per-tag weights
  disliked_ingredients text[]       not null default '{}',         -- R3: hard filter (dislike)
  disliked_menu_names  text[]       not null default '{}',         -- R3: blocked menu names
  allergies            text[]       not null default '{}',         -- R3: always hard filter
  last_servings        int,                                        -- R5: remembered servings
  created_at           timestamptz  not null default now()
);

comment on table public.preference_profiles is
  'RULES R3 taste profile + R5 last_servings. One row per auth user.';

-- =============================================================================
-- TABLE: meal_plans
-- PLAN §5 / RULES R0: a weekly plan (7 days) owned by a user.
-- =============================================================================
create table if not exists public.meal_plans (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  week_start_date date        not null,                            -- R0: week = 7 days, day 0 = Mon
  created_at      timestamptz not null default now()
);

comment on table public.meal_plans is
  'PLAN §5 weekly plan (week_start_date). RULES R0 week = 7 days.';

-- =============================================================================
-- TABLE: meal_slots
-- RULES R0: 14 slots per week = (dayIndex 0..6) x (lunch|dinner).
-- selected_menu_id points at the chosen menu_options row (nullable until chosen).
-- =============================================================================
create table if not exists public.meal_slots (
  id               uuid        primary key default gen_random_uuid(),
  plan_id          uuid        not null references public.meal_plans (id) on delete cascade,
  day_index        int         not null check (day_index between 0 and 6),  -- R0: 0=Mon .. 6=Sun
  meal             meal_type   not null,
  selected_menu_id uuid,                                            -- FK added after menu_options
  created_at       timestamptz not null default now(),
  unique (plan_id, day_index, meal)                                -- R0: one slot per (day, meal)
);

comment on table public.meal_slots is
  'RULES R0 the 14 weekly slots: (day_index 0..6) x (lunch|dinner).';

-- =============================================================================
-- TABLE: menu_options
-- RULES R1 (always 5 options/slot) + R2 (full recipe+ingredients JSON payload).
-- =============================================================================
create table if not exists public.menu_options (
  id                  uuid        primary key default gen_random_uuid(),
  slot_id             uuid        not null references public.meal_slots (id) on delete cascade,
  cuisine             cuisine     not null,                        -- R0 code
  menu_type           menu_type   not null,                        -- R2: home | dineout
  payload             jsonb       not null,                        -- R2: full menu JSON contract
  was_selected        boolean     not null default false,
  was_refreshed_away  boolean     not null default false,          -- R1-5: removed by refresh (skip)
  created_at          timestamptz not null default now()
);

comment on table public.menu_options is
  'RULES R1 5 options per slot + R2 recipe/ingredient JSON payload.';

-- meal_slots.selected_menu_id -> menu_options.id (deferred so both tables exist).
do $$ begin
  alter table public.meal_slots
    add constraint meal_slots_selected_menu_id_fkey
    foreign key (selected_menu_id) references public.menu_options (id) on delete set null;
exception when duplicate_object then null; end $$;

-- =============================================================================
-- TABLE: menu_cache
-- RULES R6-2: on-demand + caching. Keyed by constraint bucket
-- (day/meal/excluded-cuisine/taste bucket). Shared, not user-owned.
-- =============================================================================
create table if not exists public.menu_cache (
  id                uuid        primary key default gen_random_uuid(),
  cache_key         text        not null,                          -- R6-2: cache lookup key {day|meal|excluded|servings}
  day_index         int         not null check (day_index between 0 and 6),
  meal              meal_type   not null,
  excluded_cuisines text[]      not null default '{}',             -- R1-4 cooldown bucket
  servings          int,                                           -- R5
  payload           jsonb       not null,                          -- R2 menu JSON (array of 5 options)
  hit_count         int         not null default 0,
  created_at        timestamptz not null default now()
);

comment on table public.menu_cache is
  'RULES R6-2 generated-menu reuse cache. Shared across users (read-only to clients).';

-- =============================================================================
-- TABLE: selection_events
-- RULES R3: behaviour log used to update preference weights.
-- =============================================================================
create table if not exists public.selection_events (
  id         uuid             primary key default gen_random_uuid(),
  user_id    uuid             not null references auth.users (id) on delete cascade,
  menu_name  text,
  cuisine    cuisine,
  tags       text[]           not null default '{}',
  action     selection_action not null,                            -- R3: select|like|skip|dislike
  created_at timestamptz      not null default now()
);

comment on table public.selection_events is
  'RULES R3 learning event log (select/like/skip/dislike) per user.';

-- =============================================================================
-- TABLE: shopping_list_items
-- RULES R4: normalized + summed ingredients for a plan's confirmed menus.
-- =============================================================================
create table if not exists public.shopping_list_items (
  id              uuid                primary key default gen_random_uuid(),
  plan_id         uuid                not null references public.meal_plans (id) on delete cascade,
  normalized_name text                not null,                    -- R4: normalized ingredient name
  quantity        numeric,                                         -- R4: null for '약간'
  unit            text,                                            -- R4 fixed unit codes
  category        ingredient_category not null,                   -- R4 fixed category codes
  pantry_staple   boolean             not null default false,      -- R4: basic seasoning grouping
  checked         boolean             not null default false,
  source_menu_ids uuid[]              not null default '{}',       -- menu_options that contributed
  created_at      timestamptz         not null default now()
);

comment on table public.shopping_list_items is
  'RULES R4 normalized/summed shopping items for a plan''s confirmed menus.';

-- =============================================================================
-- INDEXES
-- =============================================================================
create index if not exists meal_slots_plan_id_idx          on public.meal_slots (plan_id);
create index if not exists menu_options_slot_id_idx         on public.menu_options (slot_id);
create index if not exists selection_events_user_id_idx     on public.selection_events (user_id);
create index if not exists shopping_list_items_plan_id_idx  on public.shopping_list_items (plan_id);
create index if not exists meal_plans_user_id_idx           on public.meal_plans (user_id);
create unique index if not exists menu_cache_cache_key_key
  on public.menu_cache (cache_key);

-- =============================================================================
-- ROW LEVEL SECURITY
-- Every user-owned table: a user may only touch rows they own (user_id = auth.uid()).
-- Child tables (meal_slots / menu_options / shopping_list_items) resolve ownership
-- by joining up to meal_plans via EXISTS subqueries.
-- menu_cache is shared: authenticated users may SELECT; writes via service role only.
-- =============================================================================

alter table public.preference_profiles  enable row level security;
alter table public.meal_plans           enable row level security;
alter table public.meal_slots           enable row level security;
alter table public.menu_options         enable row level security;
alter table public.menu_cache           enable row level security;
alter table public.selection_events     enable row level security;
alter table public.shopping_list_items  enable row level security;

-- --- preference_profiles: owner is user_id ----------------------------------
drop policy if exists preference_profiles_owner on public.preference_profiles;
create policy preference_profiles_owner on public.preference_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- meal_plans: owner is user_id -------------------------------------------
drop policy if exists meal_plans_owner on public.meal_plans;
create policy meal_plans_owner on public.meal_plans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- selection_events: owner is user_id -------------------------------------
drop policy if exists selection_events_owner on public.selection_events;
create policy selection_events_owner on public.selection_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- meal_slots: ownership via parent meal_plans ----------------------------
drop policy if exists meal_slots_owner on public.meal_slots;
create policy meal_slots_owner on public.meal_slots
  for all to authenticated
  using (exists (
    select 1 from public.meal_plans p
    where p.id = meal_slots.plan_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.meal_plans p
    where p.id = meal_slots.plan_id and p.user_id = auth.uid()
  ));

-- --- menu_options: ownership via slot -> plan -------------------------------
drop policy if exists menu_options_owner on public.menu_options;
create policy menu_options_owner on public.menu_options
  for all to authenticated
  using (exists (
    select 1
    from public.meal_slots s
    join public.meal_plans p on p.id = s.plan_id
    where s.id = menu_options.slot_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.meal_slots s
    join public.meal_plans p on p.id = s.plan_id
    where s.id = menu_options.slot_id and p.user_id = auth.uid()
  ));

-- --- shopping_list_items: ownership via parent meal_plans -------------------
drop policy if exists shopping_list_items_owner on public.shopping_list_items;
create policy shopping_list_items_owner on public.shopping_list_items
  for all to authenticated
  using (exists (
    select 1 from public.meal_plans p
    where p.id = shopping_list_items.plan_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.meal_plans p
    where p.id = shopping_list_items.plan_id and p.user_id = auth.uid()
  ));

-- --- menu_cache: shared read-only (RULES R6-2) ------------------------------
-- Authenticated clients may read the cache; writes happen only from the
-- Edge Function using the service role (which bypasses RLS).
drop policy if exists menu_cache_read on public.menu_cache;
create policy menu_cache_read on public.menu_cache
  for select to authenticated
  using (true);

-- =============================================================================
-- END 0001_init.sql
-- =============================================================================
