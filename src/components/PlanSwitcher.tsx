// =============================================================================
// PlanSwitcher — 상단 슬림 바. 활성 식단 이름을 보여주고, 탭하면 식단 목록(전환)과
// "공유 식단 만들기" / "코드로 참여" 액션을 펼친다. 공유 UI는 ShareSheet로 연다.
// =============================================================================
import { useState } from "react";
import {
  setActivePlan,
  useActivePlanId,
  usePlans,
} from "../lib/plans";
import ShareSheet from "./ShareSheet";
import type { ShareTab } from "./ShareSheet";

export default function PlanSwitcher() {
  const plans = usePlans();
  const activeId = useActivePlanId();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<ShareTab | null>(null);

  const active = plans.find((p) => p.id === activeId) ?? null;

  const openSheet = (tab: ShareTab) => {
    setOpen(false);
    setSheet(tab);
  };

  return (
    <>
      <div className="relative border-b border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-4 py-2 text-left"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="truncate text-sm font-semibold text-gray-900">
            {active ? active.name : "식단"}
          </span>
          {active?.kind === "shared" && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              공유
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <>
            {/* 바깥 클릭 닫기 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div
              role="menu"
              className="absolute inset-x-0 top-full z-30 mx-2 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
            >
              <ul className="max-h-64 overflow-y-auto py-1">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={p.id === activeId}
                      onClick={() => {
                        setActivePlan(p.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="w-4 text-gray-900">
                        {p.id === activeId ? "✓" : ""}
                      </span>
                      <span className="truncate text-gray-800">{p.name}</span>
                      {p.kind === "shared" && (
                        <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                          공유
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 py-1">
                <button
                  type="button"
                  onClick={() => openSheet("create")}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  공유 식단 만들기
                </button>
                <button
                  type="button"
                  onClick={() => openSheet("join")}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  코드로 참여
                </button>
                {active?.kind === "shared" && (
                  <button
                    type="button"
                    onClick={() => openSheet("manage")}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    공유 식단 관리
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <ShareSheet
        open={sheet !== null}
        initialTab={sheet ?? "manage"}
        onClose={() => setSheet(null)}
      />
    </>
  );
}
