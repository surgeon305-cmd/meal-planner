// =============================================================================
// ShareSheet — 공유 식단 관리 바텀시트(모바일 우선).
//  - 만들기: 이름으로 공유 식단 생성 → 초대 코드 노출.
//  - 참여: 코드 입력으로 공유 식단 참여.
//  - 관리: 활성 공유 식단의 코드/멤버 + 나가기(멤버) / 이름 변경(소유자).
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  createSharedPlan,
  getPlanMembers,
  joinByCode,
  leavePlan,
  renamePlan,
  useActivePlanId,
  usePlans,
} from "../lib/plans";
import type { PlanMemberRow } from "../lib/plans";

export type ShareTab = "manage" | "create" | "join";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  initialTab?: ShareTab;
}

const TABS: { id: ShareTab; label: string }[] = [
  { id: "manage", label: "관리" },
  { id: "create", label: "만들기" },
  { id: "join", label: "참여" },
];

export default function ShareSheet({
  open,
  onClose,
  initialTab = "manage",
}: ShareSheetProps) {
  const { user } = useAuth();
  const plans = usePlans();
  const activeId = useActivePlanId();
  const activePlan = plans.find((p) => p.id === activeId) ?? null;

  const [tab, setTab] = useState<ShareTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태.
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [members, setMembers] = useState<PlanMemberRow[]>([]);
  const [copied, setCopied] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 열릴 때 초기 탭/상태 리셋.
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setError(null);
    setCopied(false);
  }, [open, initialTab]);

  // 활성 공유 식단의 멤버 로드 + 이름 동기화.
  useEffect(() => {
    if (!open || !activePlan || activePlan.kind !== "shared") {
      setMembers([]);
      return;
    }
    setRenameValue(activePlan.name);
    let alive = true;
    void getPlanMembers(activePlan.id).then((rows) => {
      if (alive) setMembers(rows);
    });
    return () => {
      alive = false;
    };
  }, [open, activePlan]);

  if (!open) return null;

  const isOwner = !!activePlan && activePlan.owner_id === user?.id;

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const { error: err } = await fn();
    if (!mounted.current) return;
    setBusy(false);
    if (err) setError(err);
    return err;
  };

  const handleCreate = async () => {
    const err = await run(() => createSharedPlan(createName));
    if (!err && mounted.current) {
      setCreateName("");
      setTab("manage");
    }
  };

  const handleJoin = async () => {
    const err = await run(() => joinByCode(joinCode));
    if (!err && mounted.current) {
      setJoinCode("");
      setTab("manage");
    }
  };

  const handleLeave = async () => {
    if (!activePlan) return;
    await run(() => leavePlan(activePlan.id));
  };

  const handleRename = async () => {
    if (!activePlan) return;
    await run(() => renamePlan(activePlan.id, renameValue));
  };

  const copyCode = async () => {
    if (!activePlan?.share_code) return;
    try {
      await navigator.clipboard.writeText(activePlan.share_code);
      if (mounted.current) {
        setCopied(true);
        window.setTimeout(() => {
          if (mounted.current) setCopied(false);
        }, 1500);
      }
    } catch {
      // 클립보드 권한 없음 — 무시(코드는 화면에 노출됨).
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-4 pb-6 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />

        {/* 탭 */}
        <div className="mb-4 flex rounded-lg bg-gray-100 p-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* 만들기 */}
        {tab === "create" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              가족·룸메와 함께 쓸 공유 식단을 만들고 초대 코드를 공유하세요.
            </p>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="예: 가족 식단"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
            <button
              type="button"
              disabled={busy || !createName.trim()}
              onClick={handleCreate}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              공유 식단 만들기
            </button>
          </div>
        )}

        {/* 참여 */}
        {tab === "join" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              받은 초대 코드(6자리)를 입력해 공유 식단에 참여하세요.
            </p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="초대 코드"
              maxLength={6}
              autoCapitalize="characters"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg font-semibold tracking-[0.3em] outline-none focus:border-gray-900"
            />
            <button
              type="button"
              disabled={busy || !joinCode.trim()}
              onClick={handleJoin}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              참여하기
            </button>
          </div>
        )}

        {/* 관리 */}
        {tab === "manage" && (
          <div className="space-y-4">
            {!activePlan || activePlan.kind !== "shared" ? (
              <p className="py-6 text-center text-sm text-gray-500">
                공유 식단을 선택하면 여기서 초대 코드와 멤버를 관리할 수 있어요.
                <br />
                위 탭에서 새로 만들거나 코드로 참여해 보세요.
              </p>
            ) : (
              <>
                {/* 초대 코드 */}
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    초대 코드
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-center text-lg font-semibold tracking-[0.3em] text-gray-900">
                      {activePlan.share_code ?? "------"}
                    </code>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {copied ? "복사됨" : "복사"}
                    </button>
                  </div>
                </div>

                {/* 멤버 */}
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    멤버 {members.length}명
                  </p>
                  <ul className="space-y-1">
                    {members.map((m) => (
                      <li
                        key={m.user_id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-700">
                          {m.user_id === user?.id ? "나" : "멤버"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {m.role === "owner" ? "소유자" : "멤버"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 이름 변경 (소유자) */}
                {isOwner && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">
                      이름 변경
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                      />
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !renameValue.trim() ||
                          renameValue.trim() === activePlan.name
                        }
                        onClick={handleRename}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {/* 나가기 */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLeave}
                  className="w-full rounded-lg border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  나가기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
