// =============================================================================
// MenuSearchModal — "메뉴 고르기" (전체 보기 + 탭 + 검색 + AI 추가).
// -----------------------------------------------------------------------------
// 1) 상단 탭(전체/한·중·일·양/외식)으로 시드 풀(RULES R9)을 훑어 직접 고른다.
// 2) 검색창에 입력하면 이름/태그로 퍼지 검색(선택한 탭 범위 안에서).
// 3) 맘에 드는 게 없으면 AI 추가 생성(RULES R6) — single 모드.
//
// 시드 보기/검색은 Edge Function 없이도 동작. "추가 생성"만 함수가 필요하며
// 실패 시 친절한 에러로 우아하게 처리한다.
// =============================================================================
import { useMemo, useState } from "react";
import { seedPool } from "@shared/seed";
import type { MealType, SeedMenu } from "@shared/types";
import { generateOneMenu } from "../lib/aiMenus";
import { isHomeMenu } from "../lib/viewTypes";
import type { CuisineCode } from "../lib/viewTypes";
import { DIFFICULTY_LABELS, CUISINE_LABELS } from "../lib/uiConstants";
import CuisineChip from "./CuisineChip";

interface MenuSearchModalProps {
  /** Slot meal — forwarded to the AI prompt for context. */
  meal: MealType;
  /** Confirm a chosen/generated menu into the slot. */
  onConfirm: (menu: SeedMenu) => void;
  onClose: () => void;
}

type Tab = "ALL" | CuisineCode;
const TABS: Tab[] = ["ALL", "KR", "CN", "JP", "WS", "DINEOUT"];
const TAB_LABEL: Record<Tab, string> = {
  ALL: "전체",
  KR: CUISINE_LABELS.KR,
  CN: CUISINE_LABELS.CN,
  JP: CUISINE_LABELS.JP,
  WS: CUISINE_LABELS.WS,
  DINEOUT: CUISINE_LABELS.DINEOUT,
};

const MAX_SEARCH_RESULTS = 20;

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
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const [gen, setGen] = useState<GenState>({ status: "idle" });

  const trimmed = query.trim();

  // 탭 범위 → (검색어 있으면) 검색, 없으면 전체 목록.
  const list = useMemo(() => {
    const base =
      tab === "ALL" ? seedPool : seedPool.filter((m) => m.cuisine === tab);
    const nq = normalize(query);
    if (!nq) {
      return [...base].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }
    const scored: Array<{ menu: SeedMenu; score: number }> = [];
    for (const menu of base) {
      const score = scoreMenu(menu, nq);
      if (score !== null) scored.push({ menu, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_SEARCH_RESULTS).map((s) => s.menu);
  }, [tab, query]);

  const runGenerate = async () => {
    setGen({ status: "loading" });
    const res = await generateOneMenu(trimmed, { meal });
    if ("menu" in res) setGen({ status: "done", menu: res.menu });
    else setGen({ status: "error", message: res.error });
  };

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
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-base font-bold text-gray-900">메뉴 고르기</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 요리종류 탭 */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                tab === t
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="px-4 pt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="메뉴 검색 (예: 김치찌개)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
          />
        </div>

        <div className="mt-2 flex-1 overflow-y-auto px-4 pb-4">
          {list.length > 0 ? (
            <ul className="space-y-2">
              {list.map((menu) => (
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
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">
              {trimmed
                ? `'${trimmed}'와(과) 맞는 메뉴가 없어요.`
                : "이 탭에 메뉴가 없어요."}
            </p>
          )}

          {/* 맘에 드는 게 없으면 → AI 추가 생성 (검색어 입력 시) */}
          {trimmed.length > 0 && gen.status === "idle" && (
            <button
              type="button"
              onClick={runGenerate}
              className="mt-3 w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              ✨ '{trimmed}' 직접 추가 생성
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
              <p className="mb-1 text-xs text-gray-600">{gen.menu.description}</p>
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
        </div>
      </div>
    </div>
  );
}
