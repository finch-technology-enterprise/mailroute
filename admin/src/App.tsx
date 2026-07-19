import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

// Pages (stubs for now, built in Tasks 4-5)
function DashboardPage() {
  return <div className="rounded-lg bg-white p-6 shadow"><p className="text-gray-500">Dashboard coming in Task 5</p></div>;
}
function VendorsPage() {
  return <div className="rounded-lg bg-white p-6 shadow"><p className="text-gray-500">Vendors coming in Task 4</p></div>;
}
function TemplatesPage() {
  return <div className="rounded-lg bg-white p-6 shadow"><p className="text-gray-500">Templates coming in Task 4</p></div>;
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
