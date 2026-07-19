import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { getStats } from "../api/admin";
import type { Stats } from "../types";

function StatCard({ label, value, actionLabel, onClick, index }: { label: string; value: string; actionLabel: string; onClick: () => void; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4, delay: index * 0.08 }}
      className="card p-7"
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", fontSize: 11 }}>{label}</p>
      <p className="mt-3" style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text-primary)" }}>{value}</p>
      <motion.button
        className="apple-btn-ghost mt-5 -ml-2"
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", bounce: 0, duration: 0.12 }}
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
            <div key={i} className="card p-7">
              <div className="skeleton" style={{ height: 11, width: "40%", background: "var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 40, width: "30%", background: "var(--border)", borderRadius: "var(--radius-sm)" }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            label="Vendors"
            value={String(stats?.vendorCount ?? 0)}
            actionLabel="Manage vendors"
            onClick={() => navigate("/vendors")}
            index={0}
          />
          <StatCard
            label="Templates"
            value={String(stats?.templateCount ?? 0)}
            actionLabel="Manage templates"
            onClick={() => navigate("/templates")}
            index={1}
          />
          <StatCard
            label="Quick Test"
            value=""
            actionLabel="Send test"
            onClick={() => navigate("/test-send")}
            index={2}
          />
        </div>
      )}
    </motion.div>
  );
}
