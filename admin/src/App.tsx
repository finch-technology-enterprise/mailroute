import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import VendorsPage from "./pages/Vendors";
import TemplatesPage from "./pages/Templates";
import TestSendPage from "./pages/TestSend";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="test-send" element={<TestSendPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
