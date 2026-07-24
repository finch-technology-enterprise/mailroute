import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

const DashboardPage = lazy(() => import("./pages/Dashboard"));
const VendorsPage = lazy(() => import("./pages/Vendors"));
const TemplatesPage = lazy(() => import("./pages/Templates"));
const TestSendPage = lazy(() => import("./pages/TestSend"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLog"));
const ConfigPage = lazy(() => import("./pages/Config"));

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Suspense fallback={
          <div style={{ padding: "40px 36px" }}>
            <div className="skeleton-shimmer" style={{ height: 28, width: "30%", marginBottom: 32 }} />
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="card p-5">
                  <div className="skeleton-shimmer" style={{ height: 14, width: "40%", marginBottom: 12 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%" }} />
                </div>
              ))}
            </div>
          </div>
        }>
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
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}
