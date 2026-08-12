import { Navigate, Route, Routes } from "react-router-dom";
import {
  LoginScreen,
  useLucyAuth,
} from "@/components/auth/LoginScreen";
import { FlowEditorPage } from "@/pages/FlowEditorPage";
import { FlowListPage } from "@/pages/FlowListPage";
import { getDispatcherConfig } from "@/services/api/config";

export default function App() {
  const { session, setSession } = useLucyAuth();
  const { useMocks } = getDispatcherConfig();

  if (!useMocks && !session) {
    return <LoginScreen onAuthenticated={setSession} />;
  }

  return (
    <Routes>
      <Route path="/" element={<FlowListPage />} />
      <Route path="/flows/new" element={<FlowEditorPage />} />
      <Route path="/flows/:flowName" element={<FlowEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
