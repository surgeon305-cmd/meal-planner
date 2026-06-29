import { useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import { mockCartItems } from "../lib/mockData";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../lib/uiConstants";
import { buildShoppingLinks } from "../lib/searchLinks";
import type { CartItem, IngredientCategory } from "../lib/viewTypes";

// TODO(Phase 1): mockCartItems → useCart() (확정 메뉴 재료 합산을 서버/RPC에서).

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

export default function ShoppingListScreen() {
  const items = mockCartItems;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pantryOpen, setPantryOpen] = useState(false);

  const itemKey = (item: CartItem) => `${item.name}__${item.unit}`;
  const toggle = (item: CartItem) =>
    setChecked((prev) => ({ ...prev, [itemKey(item)]: !prev[itemKey(item)] }));

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
        subtitle={`확정 메뉴 재료 합산 · ${checkedCount}/${totalCount} 담음`}
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
