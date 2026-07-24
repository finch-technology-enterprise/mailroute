import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { getStats } from "../api/admin";
import type { Stats } from "../types";

function StatCard({ label, value, actionLabel, onClick, index }: {
  label: string;
  value: string;
  actionLabel: string;
  onClick: () => void;
  index: number;
}) {
  const iconMap: Record<string, string> = {
    Vendors: "<path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>",
    Templates: "<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/>",
    "Test Send": "<path d='M22 2L11 13'/><path d='M22 2L15 22l-4-9-9-4z'/>",
    Activity: "<polyline points='22 12 18 12 15 21 9 3 6 12 2 12'/>",
    Config: "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/>",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4, delay: index * 0.08 }}
      className="stat-card p-6"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ color: "var(--text-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", fontSize: 11, fontWeight: 500 }}>{label}</p>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", opacity: 0.1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconMap[label] || "" }} />
        </div>
      </div>
      {value ? (
        <p style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text-primary)", marginTop: "auto" }}>{value}</p>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <motion.button
        className="apple-btn-ghost"
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", bounce: 0, duration: 0.12 }}
        style={{ marginTop: 16, alignSelf: "flex-start", padding: 0, fontSize: 13 }}
      >
        {actionLabel} →
      </motion.button>
    </motion.div>
  );
}

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <h1 className="mb-10">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stat-card p-7">
              <div
                className="skeleton"
                style={{
                  height: 11,
                  width: "40%",
                  background: "var(--border)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: 16,
                }}
              />
              <div
                className="skeleton"
                style={{
                  height: 40,
                  width: "30%",
                  background: "var(--border)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Vendors"
            value={String(stats?.vendorCount ?? 0)}
            actionLabel="Manage"
            onClick={() => navigate("/vendors")}
            index={0}
          />
          <StatCard
            label="Templates"
            value={String(stats?.templateCount ?? 0)}
            actionLabel="Manage"
            onClick={() => navigate("/templates")}
            index={1}
          />
          <StatCard
            label="Test Send"
            value=""
            actionLabel="Send test"
            onClick={() => navigate("/test-send")}
            index={2}
          />
          <StatCard
            label="Activity"
            value=""
            actionLabel="View log"
            onClick={() => navigate("/activity")}
            index={3}
          />
          <StatCard
            label="Config"
            value=""
            actionLabel="Settings"
            onClick={() => navigate("/config")}
            index={4}
          />
        </div>
      )}
    </motion.div>
  );
}
