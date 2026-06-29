// =============================================================================
// 장바구니 재료 합산 — RULES R4.
// 확정(엔트리로 저장)된 메뉴들의 재료만 모아 (정규화명 + 단위) 기준으로 합산한다.
// (이전엔 mockData.ts 안에 있던 헬퍼를 여기로 이동.)
// =============================================================================
import type {
  IngredientCategory,
  MenuOption,
  SeedMenu,
  Unit,
} from "@shared/types";
import { isHomeMenu } from "./viewTypes";

/** 장바구니 합산 항목 (RULES R4). */
export interface CartItem {
  name: string;
  quantity: number;
  unit: Unit;
  category: IngredientCategory;
  pantryStaple: boolean;
}

/** 동의어 통합 (RULES R4). 실제 구현에선 더 큰 표를 코드로 관리. */
const ingredientAliases: Record<string, string> = {
  파: "대파",
  다진마늘: "마늘",
};

export function normalizeName(name: string): string {
  return ingredientAliases[name] ?? name;
}

/** 소수 첫째 자리 반올림 (RULES R5: 적당히 라운딩). */
function roundQty(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 선택 확정된 메뉴들의 재료를 합산한다 (RULES R4/R5).
 * - (정규화명 + 단위) 동일 항목은 수량 합산.
 * - 단위가 다르면 별도 항목 (임의 환산 금지).
 * - `약간`은 합산하지 않고 그대로 둔다.
 * - 외식(dineout)은 재료가 없으므로 건너뛴다.
 * - `selectedServings`가 주어지면 각 집밥 재료를 `selectedServings / menu.servings`
 *   로 비례 스케일한다 (RULES R5). `약간`·`pantryStaple`은 스케일하지 않는다.
 */
export function aggregateIngredients(
  menus: ReadonlyArray<MenuOption | SeedMenu>,
  selectedServings?: number | null,
): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const menu of menus) {
    if (!isHomeMenu(menu)) continue;
    const base = menu.servings || 1;
    const factor =
      selectedServings != null && selectedServings > 0
        ? selectedServings / base
        : 1;
    for (const ing of menu.ingredients) {
      const name = normalizeName(ing.name);
      const key = `${name}__${ing.unit}`;
      // `약간`·기본양념은 스케일 제외 (RULES R5).
      const scalable = ing.unit !== "약간" && !ing.pantryStaple;
      const qty = scalable ? roundQty(ing.quantity * factor) : ing.quantity;
      const existing = map.get(key);
      if (existing) {
        if (ing.unit !== "약간") existing.quantity = roundQty(existing.quantity + qty);
      } else {
        map.set(key, {
          name,
          quantity: qty,
          unit: ing.unit,
          category: ing.category,
          pantryStaple: ing.pantryStaple,
        });
      }
    }
  }
  return [...map.values()];
}
