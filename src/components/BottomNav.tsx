import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "식단", icon: "🍱" },
  { to: "/cart", label: "장바구니", icon: "🛒" },
  { to: "/history", label: "히스토리", icon: "📅" },
  { to: "/settings", label: "설정", icon: "⚙️" },
];

/** 하단 고정 네비게이션 (식단 / 장바구니 / 히스토리 / 설정). */
export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? "text-gray-900" : "text-gray-400"
              }`
            }
          >
            <span className="text-lg leading-none" aria-hidden>
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
