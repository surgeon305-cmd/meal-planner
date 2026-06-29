import type { MenuOption } from "../lib/viewTypes";
import { isHomeMenu } from "../lib/viewTypes";
import { DIFFICULTY_LABELS } from "../lib/uiConstants";
import CuisineChip from "./CuisineChip";

interface MenuOptionCardProps {
  menu: MenuOption;
  selected: boolean;
  /** 카드 본문 탭 → 선택/해제. */
  onSelect: () => void;
  /** 상세 보기 어포던스 탭 → /menu/:id 이동. */
  onDetail: () => void;
}

/** 한 선지(option) 카드. 집밥은 조리시간/난이도, 외식은 배지를 보여준다. */
export default function MenuOptionCard({
  menu,
  selected,
  onSelect,
  onDetail,
}: MenuOptionCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition ${
        selected
          ? "border-gray-900 ring-2 ring-gray-900"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CuisineChip cuisine={menu.cuisine} />
          {!isHomeMenu(menu) && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              외식
            </span>
          )}
        </div>
        {selected && (
          <span className="text-sm font-bold text-gray-900" aria-label="선택됨">
            ✓
          </span>
        )}
      </div>

      <p className="mt-1.5 font-semibold text-gray-900">{menu.name}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{menu.description}</p>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {isHomeMenu(menu) ? (
            <span>
              ⏱ {menu.cookTimeMin}분 · {DIFFICULTY_LABELS[menu.difficulty]} ·{" "}
              {menu.estimatedCalories}kcal
            </span>
          ) : (
            <span>🔎 {menu.searchKeyword}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDetail();
          }}
          className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          상세 →
        </button>
      </div>
    </div>
  );
}
