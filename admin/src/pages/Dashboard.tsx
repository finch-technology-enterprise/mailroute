import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStats } from "../api/admin";
import type { Stats } from "../types";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-white shadow" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-gray-500">Vendors</p>
            <p className="mt-2 text-3xl font-bold">{stats?.vendorCount ?? 0}</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-800" onClick={() => navigate("/vendors")}>Manage vendors &rarr;</button>
          </div>

          <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-gray-500">Templates</p>
            <p className="mt-2 text-3xl font-bold">{stats?.templateCount ?? 0}</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-800" onClick={() => navigate("/templates")}>Manage templates &rarr;</button>
          </div>

          <div className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-gray-500">Quick Test</p>
            <p className="mt-2 text-sm text-gray-500">Send a test email to verify your configuration.</p>
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-800" onClick={() => navigate("/test-send")}>Send test &rarr;</button>
          </div>
        </div>
      )}
    </div>
  );
}
