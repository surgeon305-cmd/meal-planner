import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import { usePlanner } from "../lib/plannerStore";
import { aggregateIngredients } from "../lib/aggregate";
import type { CartItem } from "../lib/aggregate";
import { useServings } from "../lib/preferences";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../lib/uiConstants";
import { buildShoppingLinks } from "../lib/searchLinks";
import { upcomingDates } from "../lib/dates";
import { useAuth } from "../lib/auth";
import { useActivePlanId } from "../lib/plans";
import { supabase } from "../lib/supabaseClient";
import type { IngredientCategory, SeedMenu } from "@shared/types";

// 장바구니는 확정 엔트리(visible horizon 14일)의 재료를 R4대로 합산한다 (RULES R4/R8-6).
// 체크 상태는 shopping_checks 테이블에 사용자별로 저장하여 기기·공유 멤버 간 동기화한다
// (RULES R8-6/R10). scope = 활성 plan id, item_key = `${name}__${unit}`.

const HORIZON_DAYS = 14;

function formatQty(item: CartItem): string {
  if (item.unit === "약간") return "약간";
  return `${item.quantity}${item.unit}`;
}

interface ItemRowProps {
  item: CartItem;
  checked: boolean;
  onToggle: () => void;
}

function ItemRow({ item, checked, onToggle }: ItemRowProps) {
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 shrink-0 rounded border-gray-300"
        />
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center justify-between text-left"
        >
          <span
            className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-800"}`}
          >
            {item.name}
          </span>
          <span className="text-sm text-gray-500">{formatQty(item)}</span>
        </button>
      </div>
      <div className="ml-7 mt-1 flex flex-wrap gap-2">
        {buildShoppingLinks(item.name).map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-blue-600 hover:bg-gray-200"
          >
            {link.label}
          </a>
        ))}
      </div>
    </li>
  );
}

const itemKey = (item: CartItem) => `${item.name}__${item.unit}`;

export default function ShoppingListScreen() {
  const { entries } = usePlanner();
  const servings = useServings();
  const { user } = useAuth();
  const scope = useActivePlanId();
  const userId = user?.id ?? null;

  // 화면 범위(오늘+13일)의 확정 메뉴 재료를 선택 인분 수로 스케일해 합산 (R4/R5).
  const items = useMemo(() => {
    const menus: SeedMenu[] = [];
    for (const date of upcomingDates(HORIZON_DAYS)) {
      const day = entries[date];
      if (!day) continue;
      if (day.lunch) menus.push(day.lunch.menu);
      if (day.dinner) menus.push(day.dinner.menu);
    }
    return aggregateIngredients(menus, servings);
  }, [entries, servings]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pantryOpen, setPantryOpen] = useState(false);

  // 체크 상태를 shopping_checks(user_id, scope)에서 로드하고, Realtime으로
  // 공유 plan 멤버의 변경을 실시간 반영한다. 로그인/활성 plan이 없으면 건너뛴다.
  useEffect(() => {
    if (!userId || !scope) {
      setChecked({});
      return;
    }
    let active = true;

    const reloadChecks = async () => {
      const { data, error } = await supabase
        .from("shopping_checks")
        .select("item_key, checked")
        .match({ user_id: userId, scope });
      if (!active || error || !data) return;
      const map: Record<string, boolean> = {};
      for (const row of data as { item_key: string; checked: boolean }[]) {
        if (row.checked) map[row.item_key] = true;
      }
      setChecked(map);
    };

    void reloadChecks();

    const channel = supabase
      .channel("cart-checks:" + scope)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_checks",
          filter: "scope=eq." + scope,
        },
        () => {
          void reloadChecks();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, scope]);

  // 토글: 낙관적 로컬 갱신 후 영속화. 실패 시 롤백. 비로그인/비활성 plan이면 로컬만.
  const toggle = (item: CartItem) => {
    const key = itemKey(item);
    const next = !checked[key];
    setChecked((prev) => ({ ...prev, [key]: next }));

    if (!userId || !scope) return;

    void (async () => {
      const { error } = next
        ? await supabase.from("shopping_checks").upsert(
            { user_id: userId, scope, item_key: key, checked: true },
            { onConflict: "user_id,scope,item_key" },
          )
        : await supabase
            .from("shopping_checks")
            .delete()
            .match({ user_id: userId, scope, item_key: key });
      if (error) {
        // 롤백: 직전 값으로 되돌린다.
        setChecked((prev) => ({ ...prev, [key]: !next }));
      }
    })();
  };

  // 일반 재료: 카테고리별 그룹 / 기본 양념: 별도 그룹 (RULES R4).
  const { categoryGroups, pantryItems } = useMemo(() => {
    const pantry: CartItem[] = [];
    const byCategory = new Map<IngredientCategory, CartItem[]>();
    for (const item of items) {
      if (item.pantryStaple) {
        pantry.push(item);
        continue;
      }
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    const groups = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      items: byCategory.get(c)!,
    }));
    return { categoryGroups: groups, pantryItems: pantry };
  }, [items]);

  const totalCount = items.length;
  const checkedCount = items.filter((i) => checked[itemKey(i)]).length;

  return (
    <ScreenShell>
      <AppHeader
        title="장바구니"
        subtitle={`${servings != null ? `${servings}인분 기준 · ` : ""}확정 메뉴 재료 합산 · ${checkedCount}/${totalCount} 담음`}
      />

      <div className="space-y-4 px-4 py-4">
        {categoryGroups.map((group) => (
          <section
            key={group.category}
            className="rounded-2xl border border-gray-200 bg-white px-4 shadow-sm"
          >
            <h2 className="border-b border-gray-100 py-3 text-sm font-bold text-gray-900">
              {CATEGORY_LABELS[group.category]}
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {group.items.length}
              </span>
            </h2>
            <ul className="divide-y divide-gray-100">
              {group.items.map((item) => (
                <ItemRow
                  key={itemKey(item)}
                  item={item}
                  checked={!!checked[itemKey(item)]}
                  onToggle={() => toggle(item)}
                />
              ))}
            </ul>
          </section>
        ))}

        {/* 기본 양념 (접기) */}
        {pantryItems.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white px-4 shadow-sm">
            <button
              type="button"
              onClick={() => setPantryOpen((o) => !o)}
              className="flex w-full items-center justify-between py-3 text-sm font-bold text-gray-900"
            >
              <span>
                기본 양념
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  {pantryItems.length} · 집에 있을 가능성 높음
                </span>
              </span>
              <span className="text-gray-400">{pantryOpen ? "▲" : "▼"}</span>
            </button>
            {pantryOpen && (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {pantryItems.map((item) => (
                  <ItemRow
                    key={itemKey(item)}
                    item={item}
                    checked={!!checked[itemKey(item)]}
                    onToggle={() => toggle(item)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {totalCount === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">
            아직 확정된 메뉴가 없어요. 식단에서 메뉴를 선택해 보세요.
          </p>
        )}
      </div>
    </ScreenShell>
  );
}
