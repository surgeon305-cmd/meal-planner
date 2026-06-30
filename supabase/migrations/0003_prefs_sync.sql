-- =============================================================================
-- 0003_prefs_sync.sql — 취향/설정을 계정 동기화하기 위한 컬럼 추가.
-- preference_profiles 를 단일 출처로 쓰도록 dining_style / disliked_menu_ids 추가.
-- (last_servings 는 0001 에 이미 있음 → 인분 수 동기화에 재사용.)
-- 재실행 안전: ADD COLUMN IF NOT EXISTS.
-- =============================================================================
alter table public.preference_profiles
  add column if not exists dining_style       text,
  add column if not exists disliked_menu_ids  text[] not null default '{}';

comment on column public.preference_profiles.dining_style is
  'RULES R1-2 식사 스타일: home | balanced | dineout';
comment on column public.preference_profiles.disliked_menu_ids is
  'RULES R3 차단된 메뉴 id 목록(하드 필터).';

-- 실시간 동기화(RULES R10): 공유 식단 멤버가 바꾸면 즉시 반영되도록
-- meal_entries / shopping_checks 를 Realtime publication 에 등록(멱등).
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='meal_entries') then
    execute 'alter publication supabase_realtime add table public.meal_entries';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='shopping_checks') then
    execute 'alter publication supabase_realtime add table public.shopping_checks';
  end if;
end $$;
