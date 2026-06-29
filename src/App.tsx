import { Navigate, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/LoginScreen";
import WeekPlanScreen from "./screens/WeekPlanScreen";
import MenuDetailScreen from "./screens/MenuDetailScreen";
import ShoppingListScreen from "./screens/ShoppingListScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { PlannerProvider } from "./lib/plannerStore";

/**
 * 라우팅 골격 + 식단 스토어(PlannerProvider) 마운트.
 * 확정 엔트리는 PlannerProvider에서 영구 저장된다 (RULES R8-3).
 * 인증 가드 등은 Phase 1에서 추가.
 */
export default function App() {
  return (
    <PlannerProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<WeekPlanScreen />} />
        <Route path="/menu/:menuId" element={<MenuDetailScreen />} />
        <Route path="/cart" element={<ShoppingListScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PlannerProvider>
  );
}
