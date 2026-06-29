import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 로그인 화면 (UI 전용). 실제 Supabase Auth 연동은 Phase 1.
 * 이메일 / 구글 로그인 버튼은 현재 홈으로 이동만 한다.
 */
export default function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  // TODO(Phase 1): supabase.auth.signInWithOtp / signInWithOAuth 연동.
  const handleEnter = () => navigate("/");

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🍱</div>
          <h1 className="text-2xl font-bold text-gray-900">주간 식단</h1>
          <p className="mt-1 text-sm text-gray-500">
            일주일 식단을 추천받고 장바구니까지 한 번에
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEnter();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">이메일</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            이메일로 계속하기
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          또는
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleEnter}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span className="text-base">G</span>
          구글로 계속하기
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          계속 진행하면 서비스 약관에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}
