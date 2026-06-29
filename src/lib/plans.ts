// =============================================================================
// plans — 사용자의 식단(plan) 목록 + 활성 plan 외부 스토어(useSyncExternalStore).
//
// React 컨텍스트가 아니라 모듈 단일 스토어로 둔다. plannerStore가 비-React 경로
// (getActivePlanId)에서도 활성 plan을 읽고, 활성 plan 변경을 구독해 엔트리를
// 다시 로드해야 하기 때문이다.
//
// 인증: 자체적으로 supabase.auth를 구독한다(세션 → plan 로드, 로그아웃 → 초기화).
// 활성 plan id는 localStorage(active-plan:v1)에 유지한다.
// =============================================================================
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type PlanKind = "personal" | "shared";
export type PlanRole = "owner" | "member";

export interface PlanRecord {
  id: string;
  name: string;
  owner_id: string;
  kind: PlanKind;
  share_code: string | null;
  created_at: string;
}

export interface PlanMemberRow {
  user_id: string;
  role: PlanRole;
}

export interface PlanResult {
  error: string | null;
}

const ACTIVE_KEY = "active-plan:v1";
const PERSONAL_NAME = "내 식단";
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// ---------------------------------------------------------------------------
// 모듈 상태 (개별 변수 → useSyncExternalStore 스냅샷 안정성 확보)
// ---------------------------------------------------------------------------
let plans: PlanRecord[] = [];
let activePlanId: string | null = loadActiveId();
let loading = true;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // 무시(쿼터 등).
  }
}

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

// ---------------------------------------------------------------------------
// 데이터 로드
// ---------------------------------------------------------------------------

/** plan_members → plans 조인으로 사용자가 속한 plan을 가져온다. */
async function fetchMemberPlans(userId: string): Promise<PlanRecord[]> {
  const { data, error } = await supabase
    .from("plan_members")
    .select("plans(id, name, owner_id, kind, share_code, created_at)")
    .eq("user_id", userId);
  if (error || !data) return [];
  const out: PlanRecord[] = [];
  for (const row of data as { plans: PlanRecord | PlanRecord[] | null }[]) {
    const p = Array.isArray(row.plans) ? row.plans[0] : row.plans;
    if (p) out.push(p);
  }
  return out;
}

/** personal plan을 보장한다(없으면 "내 식단" 생성 + 본인 owner 등록). 반복 호출 안전. */
async function ensurePersonalPlan(
  user: User,
  existing: PlanRecord[],
): Promise<PlanRecord | null> {
  const found = existing.find((p) => p.kind === "personal");
  if (found) return found;

  const { data: plan, error } = await supabase
    .from("plans")
    .insert({ name: PERSONAL_NAME, owner_id: user.id, kind: "personal" })
    .select("id, name, owner_id, kind, share_code, created_at")
    .single();
  if (error || !plan) return null;

  const record = plan as PlanRecord;
  const { error: mErr } = await supabase
    .from("plan_members")
    .insert({ plan_id: record.id, user_id: user.id, role: "owner" });
  if (mErr) return null;
  return record;
}

/** 현재 사용자 기준으로 plan 목록을 다시 로드하고 활성 plan을 정규화한다. */
async function reload(user: User): Promise<void> {
  loading = true;
  emit();

  let list = await fetchMemberPlans(user.id);
  if (!list.some((p) => p.kind === "personal")) {
    const personal = await ensurePersonalPlan(user, list);
    if (personal) list = [...list, personal];
  }
  plans = list;

  // 저장된 활성 id가 목록에 없으면 personal(없으면 첫 plan)로.
  if (!activePlanId || !list.some((p) => p.id === activePlanId)) {
    const fallback = list.find((p) => p.kind === "personal") ?? list[0] ?? null;
    activePlanId = fallback ? fallback.id : null;
    saveActiveId(activePlanId);
  }

  loading = false;
  emit();
}

/** 세션 변화 처리. 같은 사용자로 중복 호출되면 재로드를 건너뛴다. */
async function handleUser(user: User | null): Promise<void> {
  if (!user) {
    currentUserId = null;
    plans = [];
    activePlanId = null;
    loading = false;
    emit();
    return;
  }
  if (user.id === currentUserId) return; // 이미 이 사용자로 로드됨.
  currentUserId = user.id;
  await reload(user);
}

let initialized = false;
function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void supabase.auth.getUser().then(({ data }) => handleUser(data.user ?? null));
  supabase.auth.onAuthStateChange((_event, session) => {
    void handleUser(session?.user ?? null);
  });
}
init();

// ---------------------------------------------------------------------------
// 외부 액션 (UI에 throw하지 않고 { error }로 처리)
// ---------------------------------------------------------------------------

export function getActivePlanId(): string | null {
  return activePlanId;
}

/** plannerStore가 활성 plan 변경을 구독하기 위한 비-React 구독. */
export function subscribePlans(listener: () => void): () => void {
  return subscribe(listener);
}

export function setActivePlan(id: string): void {
  if (id === activePlanId) return;
  if (!plans.some((p) => p.id === id)) return;
  activePlanId = id;
  saveActiveId(id);
  emit();
}

export async function createSharedPlan(name: string): Promise<PlanResult> {
  if (!currentUserId) return { error: "로그인이 필요합니다." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "식단 이름을 입력하세요." };

  let created: PlanRecord | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data, error } = await supabase
      .from("plans")
      .insert({
        name: trimmed,
        owner_id: currentUserId,
        kind: "shared",
        share_code: code,
      })
      .select("id, name, owner_id, kind, share_code, created_at")
      .single();
    if (!error && data) {
      created = data as PlanRecord;
      break;
    }
    if (error && error.code === "23505") continue; // 코드 충돌 → 재시도.
    return { error: error?.message ?? "식단 생성에 실패했습니다." };
  }
  if (!created) return { error: "초대 코드 생성에 실패했습니다. 다시 시도하세요." };

  const { error: mErr } = await supabase
    .from("plan_members")
    .insert({ plan_id: created.id, user_id: currentUserId, role: "owner" });
  if (mErr) return { error: mErr.message };

  plans = [...plans, created];
  activePlanId = created.id;
  saveActiveId(activePlanId);
  emit();
  return { error: null };
}

export async function joinByCode(code: string): Promise<PlanResult> {
  if (!currentUserId) return { error: "로그인이 필요합니다." };
  const norm = code.trim().toUpperCase();
  if (!norm) return { error: "초대 코드를 입력하세요." };

  const { data, error } = await supabase.rpc("join_plan_by_code", {
    p_code: norm,
  });
  if (error) return { error: error.message };
  if (!data) return { error: "해당 코드의 식단을 찾을 수 없습니다." };

  const planId = data as string;
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) await reload(userData.user);
  setActivePlan(planId);
  return { error: null };
}

export async function leavePlan(id: string): Promise<PlanResult> {
  if (!currentUserId) return { error: "로그인이 필요합니다." };
  const target = plans.find((p) => p.id === id);
  if (target?.kind === "personal") {
    return { error: "개인 식단은 나갈 수 없습니다." };
  }
  const { error } = await supabase
    .from("plan_members")
    .delete()
    .match({ plan_id: id, user_id: currentUserId });
  if (error) return { error: error.message };

  plans = plans.filter((p) => p.id !== id);
  if (activePlanId === id) {
    const fallback =
      plans.find((p) => p.kind === "personal") ?? plans[0] ?? null;
    activePlanId = fallback ? fallback.id : null;
    saveActiveId(activePlanId);
  }
  emit();
  return { error: null };
}

export async function renamePlan(id: string, name: string): Promise<PlanResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "식단 이름을 입력하세요." };
  const { error } = await supabase
    .from("plans")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) return { error: error.message };

  plans = plans.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
  emit();
  return { error: null };
}

export async function getPlanMembers(planId: string): Promise<PlanMemberRow[]> {
  const { data, error } = await supabase
    .from("plan_members")
    .select("user_id, role")
    .eq("plan_id", planId);
  if (error || !data) return [];
  return data as PlanMemberRow[];
}

// ---------------------------------------------------------------------------
// React 훅
// ---------------------------------------------------------------------------
export function usePlans(): PlanRecord[] {
  return useSyncExternalStore(
    subscribe,
    () => plans,
    () => plans,
  );
}

export function useActivePlanId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => activePlanId,
    () => activePlanId,
  );
}

export function usePlansLoading(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loading,
    () => loading,
  );
}
