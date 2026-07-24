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
const ApiKeysPage = lazy(() => import("./pages/ApiKeys"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePassword"));
const LoginPage = lazy(() => import("./pages/Login"));
const SignupPage = lazy(() => import("./pages/Signup"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));

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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="test-send" element={<TestSendPage />} />
              <Route path="activity" element={<ActivityLogPage />} />
              <Route path="settings" element={<ChangePasswordPage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}
