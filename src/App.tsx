import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginScreen from "./screens/LoginScreen";
import WeekPlanScreen from "./screens/WeekPlanScreen";
import MenuDetailScreen from "./screens/MenuDetailScreen";
import ShoppingListScreen from "./screens/ShoppingListScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { PlannerProvider } from "./lib/plannerStore";
import { AuthProvider, useAuth } from "./lib/auth";

/**
 * 인증 가드. 첫 세션 해석 전에는 스피너, 비로그인은 /login으로, 로그인 상태에서
 * /login 접근은 홈으로 보낸다 (RULES R8-1).
 */
function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        <p className="text-sm text-gray-500">불러오는 중…</p>
      </div>
    );
  }

  const isLogin = location.pathname === "/login";
  if (!user && !isLogin) return <Navigate to="/login" replace />;
  if (user && isLogin) return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<WeekPlanScreen />} />
      <Route path="/menu/:menuId" element={<MenuDetailScreen />} />
      <Route path="/cart" element={<ShoppingListScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * 라우팅 골격 + 인증(AuthProvider) + 식단 스토어(PlannerProvider) 마운트.
 * 확정 엔트리는 Supabase meal_entries에 영구 저장된다 (RULES R8-3).
 */
export default function App() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <AuthGate />
      </PlannerProvider>
    </AuthProvider>
  );
}
