import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardPage from "./pages/Dashboard";
import VendorsPage from "./pages/Vendors";
import TemplatesPage from "./pages/Templates";
import TestSendPage from "./pages/TestSend";
import ActivityLogPage from "./pages/ActivityLog";
import ConfigPage from "./pages/Config";

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="test-send" element={<TestSendPage />} />
            <Route path="activity" element={<ActivityLogPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </ToastProvider>
  );
}
