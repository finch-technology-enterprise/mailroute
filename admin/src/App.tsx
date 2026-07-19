import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import VendorsPage from "./pages/Vendors";
import TemplatesPage from "./pages/Templates";

function DashboardPage() {
  return <div className="rounded-lg bg-white p-6 shadow"><p className="text-gray-500">Dashboard coming in Task 5</p></div>;
}
function TestSendPage() {
  return <div className="rounded-lg bg-white p-6 shadow"><p className="text-gray-500">Test Send coming in Task 5</p></div>;
}

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
