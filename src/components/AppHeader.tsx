import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** 뒤로가기 버튼 표시 여부. */
  showBack?: boolean;
  /** 우측 액션 영역. */
  action?: ReactNode;
}

/** 화면 상단 고정 헤더. */
export default function AppHeader({ title, subtitle, showBack, action }: AppHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="-ml-1 rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
