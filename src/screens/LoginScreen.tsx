import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Mode = "signin" | "signup";

/**
 * 로그인 화면. Supabase Auth(이메일+비밀번호) 연동 — RULES R8-1.
 * 로그인/회원가입 토글, 성공 시 홈으로 이동. 구글 OAuth는 미구성(준비 중).
 */
export default function LoginScreen() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const { error: authError } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
    setSubmitting(false);

    if (authError) {
      setError(
        mode === "signin"
          ? "로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요."
          : "회원가입에 실패했어요. 이미 가입된 이메일이거나 비밀번호가 너무 짧을 수 있어요.",
      );
      return;
    }
    navigate("/");
  };

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

        <div className="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 transition ${
              mode === "signin"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-md py-2 transition ${
              mode === "signup"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">비밀번호</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {submitting
              ? "처리 중…"
              : mode === "signin"
                ? "로그인"
                : "회원가입"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          또는
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={async () => {
            setError(null);
            const { error: oauthError } = await signInWithGoogle();
            if (oauthError) {
              setError(
                "구글 로그인을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.",
              );
            }
            // 성공 시 구글 동의 화면으로 리다이렉트된다.
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span className="text-base font-bold text-[#4285F4]">G</span>
          구글로 계속하기
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          계속 진행하면 서비스 약관에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}
