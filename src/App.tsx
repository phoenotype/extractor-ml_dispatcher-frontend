import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import {
  LoginScreen,
  useLucyAuth,
} from "@/components/auth/LoginScreen";
import { FlowEditorPage } from "@/pages/FlowEditorPage";
import { FlowListPage } from "@/pages/FlowListPage";
import { getDispatcherConfig } from "@/services/api/config";

const router = createBrowserRouter([
  { path: "/", element: <FlowListPage /> },
  { path: "/flows/new", element: <FlowEditorPage /> },
  { path: "/flows/:flowName", element: <FlowEditorPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  const { session, setSession } = useLucyAuth();
  const { useMocks } = getDispatcherConfig();

  if (!useMocks && !session) {
    return <LoginScreen onAuthenticated={setSession} />;
  }

  return <RouterProvider router={router} />;
}
