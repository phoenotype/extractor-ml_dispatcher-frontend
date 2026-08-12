import { Navigate, Route, Routes } from "react-router-dom";
import { FlowEditorPage } from "@/pages/FlowEditorPage";
import { FlowListPage } from "@/pages/FlowListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FlowListPage />} />
      <Route path="/flows/new" element={<FlowEditorPage />} />
      <Route path="/flows/:flowName" element={<FlowEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
