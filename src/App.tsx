import { Navigate, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/LoginScreen";
import WeekPlanScreen from "./screens/WeekPlanScreen";
import MenuDetailScreen from "./screens/MenuDetailScreen";
import ShoppingListScreen from "./screens/ShoppingListScreen";
import SettingsScreen from "./screens/SettingsScreen";

/**
 * 라우팅 골격. 화면 내용은 ui-screens 에이전트가 채운다.
 * 인증 가드 등은 Phase 1에서 추가.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<WeekPlanScreen />} />
      <Route path="/menu/:menuId" element={<MenuDetailScreen />} />
      <Route path="/cart" element={<ShoppingListScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
