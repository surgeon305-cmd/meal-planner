import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import PlanSwitcher from "./PlanSwitcher";

interface ScreenShellProps {
  children: ReactNode;
  /** 하단 네비게이션 표시 여부 (로그인/상세 등에선 숨김). */
  showNav?: boolean;
}

/**
 * 공통 모바일 레이아웃 셸. 가운데 정렬된 max-w-md 컨테이너 +
 * (옵션) 하단 네비게이션 + 그만큼의 하단 패딩.
 */
export default function ScreenShell({ children, showNav = true }: ScreenShellProps) {
  return (
    <div className="min-h-full bg-gray-50 text-gray-900">
      <div className={`mx-auto max-w-md ${showNav ? "pb-20" : ""}`}>
        {showNav && <PlanSwitcher />}
        {children}
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
