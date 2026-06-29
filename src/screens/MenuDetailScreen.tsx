import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import CuisineChip from "../components/CuisineChip";
import { getMenuById } from "../lib/mockData";
import { isHomeMenu } from "../lib/viewTypes";
import type { Ingredient, IngredientCategory } from "../lib/viewTypes";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DIFFICULTY_LABELS,
} from "../lib/uiConstants";
import { buildDineoutLinks } from "../lib/searchLinks";

// TODO(Phase 1): getMenuById → useMenu(menuId). 좋아요/싫어요는 selection_events 기록.

type Feedback = "like" | "dislike" | null;

function formatQty(ing: Ingredient): string {
  if (ing.unit === "약간") return "약간";
  return `${ing.quantity}${ing.unit}`;
}

export default function MenuDetailScreen() {
  const { menuId } = useParams<{ menuId: string }>();
  const menu = menuId ? getMenuById(menuId) : undefined;
  const [feedback, setFeedback] = useState<Feedback>(null);

  // 집밥 메뉴 재료를 카테고리별로 그룹화 (RULES R4 순서).
  const groupedIngredients = useMemo(() => {
    if (!menu || !isHomeMenu(menu)) return [];
    const map = new Map<IngredientCategory, Ingredient[]>();
    for (const ing of menu.ingredients) {
      const list = map.get(ing.category) ?? [];
      list.push(ing);
      map.set(ing.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }));
  }, [menu]);

  if (!menu) {
    return (
      <ScreenShell showNav={false}>
        <AppHeader title="메뉴 상세" showBack />
        <div className="px-4 py-10 text-center text-sm text-gray-500">
          메뉴를 찾을 수 없습니다.
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <AppHeader title={menu.name} showBack />

      <div className="space-y-5 px-4 py-4">
        {/* 요약 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <CuisineChip cuisine={menu.cuisine} />
            {menu.type === "dineout" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                외식
              </span>
            )}
            {menu.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                #{t}
              </span>
            ))}
          </div>
          <h2 className="text-lg font-bold text-gray-900">{menu.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{menu.description}</p>
          {isHomeMenu(menu) && (
            <div className="mt-3 flex gap-4 text-xs text-gray-600">
              <span>⏱ {menu.cookTimeMin}분</span>
              <span>🔥 {DIFFICULTY_LABELS[menu.difficulty]}</span>
              <span>👥 {menu.servings}인분</span>
              <span>⚡ {menu.estimatedCalories}kcal</span>
            </div>
          )}
        </section>

        {isHomeMenu(menu) ? (
          <>
            {/* 조리 단계 */}
            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-900">조리 단계</h3>
              <ol className="space-y-2">
                {menu.recipe.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">
                      {step.replace(/^\d+\.\s*/, "")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* 팁 */}
            {menu.recipe.tips.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <h3 className="mb-1 text-sm font-bold text-amber-800">💡 팁</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
                  {menu.recipe.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 재료 (카테고리별) */}
            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-900">재료</h3>
              <div className="space-y-3">
                {groupedIngredients.map((group) => (
                  <div
                    key={group.category}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <p className="mb-2 text-xs font-semibold text-gray-400">
                      {CATEGORY_LABELS[group.category]}
                    </p>
                    <ul className="space-y-1.5">
                      {group.items.map((ing, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-800">
                            {ing.name}
                            {ing.pantryStaple && (
                              <span className="ml-1 text-xs text-gray-400">
                                (기본양념)
                              </span>
                            )}
                          </span>
                          <span className="text-gray-500">{formatQty(ing)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* 외식: 검색 키워드 + 외부 검색 링크 */
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-bold text-gray-900">외식 메뉴</h3>
            <p className="text-sm text-gray-500">
              레시피 없이 사먹는 메뉴예요. 아래에서 가까운 맛집을 찾아보세요.
            </p>
            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
              검색 키워드:{" "}
              <span className="font-semibold text-gray-900">
                {menu.searchKeyword}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {buildDineoutLinks(menu.searchKeyword).map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  {link.label}에서 찾기 →
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 좋아요 / 싫어요 */}
        <section className="flex gap-3">
          <button
            type="button"
            onClick={() => setFeedback((f) => (f === "like" ? null : "like"))}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition ${
              feedback === "like"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            👍 좋아요
          </button>
          <button
            type="button"
            onClick={() => setFeedback((f) => (f === "dislike" ? null : "dislike"))}
            className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition ${
              feedback === "dislike"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            👎 싫어요
          </button>
        </section>
      </div>
    </ScreenShell>
  );
}
