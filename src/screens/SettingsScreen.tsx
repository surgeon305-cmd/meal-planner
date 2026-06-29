import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import ScreenShell from "../components/ScreenShell";
import ChipInput from "../components/ChipInput";

// TODO(Phase 1): localStorage → preference_profiles (Supabase). 학습 초기화는 RPC 호출.

const SERVINGS_KEY = "mp.servings";
const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function SettingsScreen() {
  // RULES R5: 고정 기본 인분 없음. 마지막 선택값을 기억하되 강제 고정하지 않는다.
  const [servings, setServings] = useState<number | null>(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(SERVINGS_KEY) : null;
    return saved ? Number(saved) : null;
  });
  const [allergies, setAllergies] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (servings !== null) window.localStorage.setItem(SERVINGS_KEY, String(servings));
  }, [servings]);

  const handleReset = () => {
    setAllergies([]);
    setDisliked([]);
    setResetDone(true);
    window.setTimeout(() => setResetDone(false), 2000);
  };

  return (
    <ScreenShell>
      <AppHeader title="설정" subtitle="취향·인분 수 관리" />

      <div className="space-y-4 px-4 py-4">
        {/* 인분 수 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">인분 수</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            고정 기본값은 없어요. 선택한 값을 다음에 기본으로 보여줘요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SERVINGS_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setServings(n)}
                className={`h-10 w-10 rounded-full border text-sm font-semibold transition ${
                  servings === n
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {servings === null ? "아직 선택 안 함" : `현재 ${servings}인분`}
          </p>
        </section>

        {/* 알레르기 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">알레르기</h2>
          <p className="mt-0.5 mb-3 text-xs text-gray-500">
            추가한 재료는 추천에서 항상 제외돼요 (하드 필터).
          </p>
          <ChipInput
            values={allergies}
            onChange={setAllergies}
            placeholder="예: 갑각류, 땅콩"
          />
        </section>

        {/* 비선호 재료 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">비선호 재료</h2>
          <p className="mt-0.5 mb-3 text-xs text-gray-500">
            싫어하는 재료를 넣으면 메뉴 추천에서 빼드려요.
          </p>
          <ChipInput
            values={disliked}
            onChange={setDisliked}
            placeholder="예: 오이, 고수"
          />
        </section>

        {/* 학습 초기화 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">학습 초기화</h2>
          <p className="mt-0.5 mb-3 text-xs text-gray-500">
            그동안 쌓인 취향 가중치와 입력값을 초기화해요.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-lg border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            {resetDone ? "초기화 완료 ✓" : "학습 초기화"}
          </button>
        </section>

        <p className="px-1 text-center text-xs text-gray-400">
          {/* 로그인된 사용자: surgeon305@gmail.com — Phase 1에서 실제 세션과 연결 */}
          설정은 현재 기기에만 저장돼요 (임시).
        </p>
      </div>
    </ScreenShell>
  );
}
