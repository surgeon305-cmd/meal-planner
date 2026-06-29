// =============================================================================
// MenuSearchModal — "메뉴 검색 & 추가" (search the seed pool, or AI-generate).
// -----------------------------------------------------------------------------
// 1) Fuzzy-searches the seed pool (RULES R9) by name/tags as the user types.
//    Selecting a result confirms it into the slot (caller's onConfirm).
// 2) When nothing matches (or the user wants something new), offers AI
//    generation via aiMenus.generateOneMenu (RULES R6) — single-menu mode.
//
// The seed search works WITHOUT the Edge Function deployed; only "추가 생성"
// needs it, and it degrades gracefully (friendly error) when it errors.
// =============================================================================
import { useMemo, useState } from "react";
import { seedPool } from "@shared/seed";
import type { MealType, SeedMenu } from "@shared/types";
import { generateOneMenu } from "../lib/aiMenus";
import { isHomeMenu } from "../lib/viewTypes";
import { DIFFICULTY_LABELS } from "../lib/uiConstants";
import CuisineChip from "./CuisineChip";

interface MenuSearchModalProps {
  /** Slot meal — forwarded to the AI prompt for context. */
  meal: MealType;
  /** Confirm a chosen/generated menu into the slot. */
  onConfirm: (menu: SeedMenu) => void;
  onClose: () => void;
}

const MAX_RESULTS = 12;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** Is `q` a (gap-allowing) subsequence of `text`? Cheap fuzzy fallback. */
function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

/** Score a menu against a query; higher is better, null = no match. */
function scoreMenu(menu: SeedMenu, nq: string): number | null {
  const name = normalize(menu.name);
  if (name.includes(nq)) return 1000 - (name.length - nq.length);
  const desc = normalize(menu.description);
  for (const tag of menu.tags) {
    if (normalize(tag).includes(nq)) return 600;
  }
  if (desc.includes(nq)) return 400;
  if (isSubsequence(nq, name)) return 200;
  return null;
}

function searchSeed(query: string): SeedMenu[] {
  const nq = normalize(query);
  if (!nq) return [];
  const scored: Array<{ menu: SeedMenu; score: number }> = [];
  for (const menu of seedPool) {
    const score = scoreMenu(menu, nq);
    if (score !== null) scored.push({ menu, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS).map((s) => s.menu);
}

type GenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; menu: SeedMenu }
  | { status: "error"; message: string };

export default function MenuSearchModal({
  meal,
  onConfirm,
  onClose,
}: MenuSearchModalProps) {
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState<GenState>({ status: "idle" });

  const trimmed = query.trim();
  const results = useMemo(() => searchSeed(query), [query]);

  const runGenerate = async () => {
    setGen({ status: "loading" });
    const res = await generateOneMenu(trimmed, { meal });
    if ("menu" in res) setGen({ status: "done", menu: res.menu });
    else setGen({ status: "error", message: res.error });
  };

  // Typing invalidates a previous generation attempt.
  const onChangeQuery = (value: string) => {
    setQuery(value);
    if (gen.status !== "idle") setGen({ status: "idle" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">메뉴 검색 / 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          autoFocus
          placeholder="먹고 싶은 메뉴를 입력하세요 (예: 김치찌개)"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        />

        <div className="mt-3 flex-1 overflow-y-auto">
          {/* Seed-pool matches */}
          {results.length > 0 && (
            <ul className="space-y-2">
              {results.map((menu) => (
                <li key={menu.id}>
                  <button
                    type="button"
                    onClick={() => onConfirm(menu)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-gray-900"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <CuisineChip cuisine={menu.cuisine} />
                        <span className="truncate font-semibold text-gray-900">
                          {menu.name}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-gray-500">
                        {menu.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-blue-600">
                      선택
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* No seed match → offer AI generation */}
          {trimmed.length > 0 && results.length === 0 &&
            gen.status === "idle" && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-700">
                '<span className="font-semibold">{trimmed}</span>'은(는) 없는
                메뉴입니다. 추가 생성할까요?
              </p>
              <button
                type="button"
                onClick={runGenerate}
                className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
              >
                ✨ 추가 생성
              </button>
            </div>
          )}

          {/* When there ARE matches, still allow generating something new */}
          {trimmed.length > 0 && results.length > 0 &&
            gen.status === "idle" && (
            <button
              type="button"
              onClick={runGenerate}
              className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              원하는 메뉴가 없나요? '{trimmed}' 추가 생성
            </button>
          )}

          {gen.status === "loading" && (
            <div className="py-6 text-center text-sm text-gray-500">
              <span className="inline-block animate-pulse">
                '{trimmed}' 메뉴를 생성하는 중…
              </span>
            </div>
          )}

          {gen.status === "error" && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-600">{gen.message}</p>
              <button
                type="button"
                onClick={runGenerate}
                className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                다시 시도
              </button>
            </div>
          )}

          {gen.status === "done" && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-xs font-medium text-green-700">
                새 메뉴가 생성되었어요
              </p>
              <div className="mb-1 flex items-center gap-1.5">
                <CuisineChip cuisine={gen.menu.cuisine} />
                {!isHomeMenu(gen.menu) && (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-gray-600">
                    외식
                  </span>
                )}
                <span className="font-semibold text-gray-900">
                  {gen.menu.name}
                </span>
              </div>
              <p className="mb-1 text-xs text-gray-600">
                {gen.menu.description}
              </p>
              {isHomeMenu(gen.menu) && (
                <p className="mb-3 text-xs text-gray-500">
                  ⏱ {gen.menu.cookTimeMin}분 ·{" "}
                  {DIFFICULTY_LABELS[gen.menu.difficulty]} ·{" "}
                  {gen.menu.estimatedCalories}kcal
                </p>
              )}
              <button
                type="button"
                onClick={() => onConfirm(gen.menu)}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
              >
                '{gen.menu.name}' 확정
              </button>
            </div>
          )}

          {trimmed.length === 0 && results.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              메뉴 이름을 입력하면 비슷한 메뉴를 찾아드려요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
