-- =============================================================================
-- 0002_sharing.sql — 공유 식단(SHARED MEAL PLANS)
-- 여러 사용자가 함께 보고 편집하는 이름 있는 식단(plan). meal_entries는 이제
-- "사용자"가 아니라 "활성 plan"에 속한다 (RULES R8 날짜 모델은 그대로, 소유 단위만
-- 사용자→plan으로 확장).
--
-- 재실행 안전(idempotent): guarded type checks, IF NOT EXISTS, drop-then-create
-- policy. RLS 재귀 방지를 위해 멤버십 검사는 security definer 함수로 캡슐화한다.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLE: plans — 이름 있는 식단. personal(내 식단) 1개 + shared(가족/룸메 식단) N개.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  owner_id   uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('personal','shared')),
  share_code text        unique,                       -- shared 초대 코드(6자 A-Z0-9)
  created_at timestamptz not null default now()
);
comment on table public.plans is 'RULES: 이름 있는 식단(personal/shared). meal_entries의 소유 단위. shared는 share_code로 초대.';

-- ---------------------------------------------------------------------------
-- TABLE: plan_members — plan ↔ user 멤버십. owner는 plan 생성자.
-- ---------------------------------------------------------------------------
create table if not exists public.plan_members (
  id         uuid        primary key default gen_random_uuid(),
  plan_id    uuid        not null references public.plans (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (plan_id, user_id)
);
comment on table public.plan_members is 'RULES: plan 참여자. 한 plan에 user 1행. role owner/member.';

create index if not exists plan_members_user_idx on public.plan_members (user_id);
create index if not exists plan_members_plan_idx on public.plan_members (plan_id);

-- ---------------------------------------------------------------------------
-- ALTER meal_entries — plan_id 추가. (날짜, 끼니) 유니크를 user→plan 기준으로 이전.
-- 기존 행은 테스트 데이터이므로 제약 강화 전에 정리한다(RULES R8: 확정 엔트리).
-- ---------------------------------------------------------------------------
alter table public.meal_entries
  add column if not exists plan_id uuid references public.plans (id) on delete cascade;

-- plan_id 없는 기존(테스트) 엔트리 제거 → 재실행 시엔 not null이라 매칭 0건(안전).
delete from public.meal_entries where plan_id is null;

alter table public.meal_entries alter column plan_id set not null;

-- 옛 per-user 유니크 제거, plan 기준 유니크로 교체.
alter table public.meal_entries drop constraint if exists meal_entries_user_id_entry_date_meal_key;
alter table public.meal_entries drop constraint if exists meal_entries_plan_id_entry_date_meal_key;
alter table public.meal_entries add  constraint meal_entries_plan_id_entry_date_meal_key
  unique (plan_id, entry_date, meal);     -- plan당 (날짜, 끼니) 1개 확정

create index if not exists meal_entries_plan_date_idx on public.meal_entries (plan_id, entry_date);
comment on column public.meal_entries.plan_id is 'RULES: 이 엔트리가 속한 plan. user_id는 누가 정했는지 기록용으로 유지.';

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER 함수 — RLS 재귀 방지의 핵심.
-- plan_members 정책에서 plans를, plans 정책에서 plan_members를 직접 참조하면
-- 정책 평가가 서로를 호출해 재귀한다. definer 함수는 RLS를 우회해 plan_members를
-- 직접 읽으므로 정책끼리 순환하지 않는다.
-- ---------------------------------------------------------------------------
create or replace function public.is_plan_member(p_plan uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.plan_members
    where plan_id = p_plan and user_id = auth.uid()
  );
$$;
comment on function public.is_plan_member(uuid) is 'RULES: 현재 사용자가 해당 plan 멤버인지. security definer로 RLS 재귀 차단.';

-- 비멤버는 RLS상 plans를 SELECT할 수 없으므로 share_code 조회가 불가능하다.
-- definer 함수로 코드→plan을 찾아 본인을 멤버로 추가한다(다른 plan 노출 없음).
create or replace function public.join_plan_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan uuid;
begin
  select id into v_plan from public.plans where share_code = p_code limit 1;
  if v_plan is null then
    return null;
  end if;
  insert into public.plan_members (plan_id, user_id, role)
    values (v_plan, auth.uid(), 'member')
    on conflict (plan_id, user_id) do nothing;
  return v_plan;
end;
$$;
comment on function public.join_plan_by_code(text) is 'RULES: 초대 코드로 shared plan 참여. 비멤버 조회 위해 security definer.';

grant execute on function public.is_plan_member(uuid)    to authenticated;
grant execute on function public.join_plan_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.plans        enable row level security;
alter table public.plan_members enable row level security;

-- plans -------------------------------------------------------------------
-- SELECT: 멤버이거나 소유자. (소유자 포함은 INSERT ... RETURNING이 멤버십 등록 전에
--   행을 돌려줄 수 있게 하기 위함 — 생성 직후 본인 plan을 읽어야 함.)
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated
  using (public.is_plan_member(id) or owner_id = auth.uid());

drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists plans_delete on public.plans;
create policy plans_delete on public.plans
  for delete to authenticated
  using (owner_id = auth.uid());

-- plan_members ------------------------------------------------------------
-- SELECT: 같은 plan 멤버는 서로를 볼 수 있다.
drop policy if exists plan_members_select on public.plan_members;
create policy plan_members_select on public.plan_members
  for select to authenticated
  using (public.is_plan_member(plan_id));

-- INSERT: 본인이 스스로 참여(user_id=auth.uid()) 하거나, plan 소유자가 추가.
drop policy if exists plan_members_insert on public.plan_members;
create policy plan_members_insert on public.plan_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid())
  );

-- DELETE: 본인 나가기(user_id=auth.uid()) 또는 plan 소유자가 제거.
drop policy if exists plan_members_delete on public.plan_members;
create policy plan_members_delete on public.plan_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid())
  );

-- meal_entries ------------------------------------------------------------
-- 옛 per-user 정책 제거, 멤버십 기준으로 교체 (RULES R8: 활성 plan 멤버만 편집).
drop policy if exists meal_entries_owner   on public.meal_entries;
drop policy if exists meal_entries_members on public.meal_entries;
create policy meal_entries_members on public.meal_entries
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

-- =============================================================================
-- END 0002_sharing.sql
-- =============================================================================
