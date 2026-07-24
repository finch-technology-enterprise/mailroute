import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { getStats } from "../api/admin";
import { get } from "../api/client";
import type { Stats, ApiResponse } from "../types";
import Icon from "../components/Icon";

interface LogEntry {
  id: string;
  type: string;
  summary: string;
  detail: string | null;
  status: string | null;
  createdAt: string;
}

const iconNameMap: Record<string, string> = {
  Vendors: "vendors",
  Templates: "templates",
  "Test Send": "test-send",
  Activity: "activity",
  Settings: "config",
};

function StatCard({ label, value, actionLabel, onClick }: {
  label: string;
  value: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className="stat-card p-6"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ color: "var(--text-secondary)", letterSpacing: "0.02em", textTransform: "uppercase", fontSize: 11, fontWeight: 600 }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", opacity: 0.08, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={iconNameMap[label]} size={17} color="var(--accent)" strokeWidth={1.5} />
        </div>
      </div>
      <div style={{ marginTop: value ? 0 : "auto" }}>
        {value ? (
          <p style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text-primary)" }}>{value}</p>
        ) : (
          <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-tertiary)", lineHeight: 1 }}>—</p>
        )}
      </div>
      <motion.button
        className="apple-btn-ghost"
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", bounce: 0, duration: 0.12 }}
        style={{ marginTop: 14, alignSelf: "flex-start", padding: "4px 0", fontSize: 13, fontWeight: 500 }}
      >
        {actionLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </motion.button>
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const nav = useCallback((to: string) => () => navigate(to), [navigate]);

  useEffect(() => {
    Promise.all([
      getStats(),
      get<ApiResponse<LogEntry[]>>("/logs").catch(() => ({ success: true, message: null, data: [] }) as unknown as ApiResponse<LogEntry[]>),
    ])
      .then(([s, l]) => {
        setStats(s.data);
        setRecentLogs((l.data || []).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div className="mb-8">
        <h1 className="mb-1">Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {loading ? "Loading..." : `${stats?.vendorCount ?? 0} vendor${(stats?.vendorCount ?? 0) !== 1 ? "s" : ""}, ${stats?.templateCount ?? 0} template${(stats?.templateCount ?? 0) !== 1 ? "s" : ""}`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="stat-card p-6">
                <div className="skeleton-shimmer" style={{ height: 11, width: "50%", marginBottom: 16 }} />
                <div className="skeleton-shimmer" style={{ height: 34, width: "40%" }} />
              </div>
            ))}
          </div>
          <div className="card p-6">
            <div className="skeleton-shimmer" style={{ height: 14, width: "30%", marginBottom: 16 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 12, width: "80%", marginBottom: 10 }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Vendors" value={String(stats?.vendorCount ?? 0)} actionLabel="Manage" onClick={nav("/vendors")} />
            <StatCard label="Templates" value={String(stats?.templateCount ?? 0)} actionLabel="Manage" onClick={nav("/templates")} />
            <StatCard label="Test Send" value="" actionLabel="Send test" onClick={nav("/test-send")} />
            <StatCard label="Activity" value="" actionLabel="View log" onClick={nav("/activity")} />
            <StatCard label="Settings" value="" actionLabel="Settings" onClick={nav("/settings")} />
          </div>

          {recentLogs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4, delay: 0.4 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Activity</h2>
                <button className="apple-link" onClick={() => navigate("/activity")} style={{ fontSize: 12 }}>View all</button>
              </div>
              <div className="card overflow-hidden">
                {recentLogs.map((log, i) => {
                  const isSent = log.type === "email_sent";
                  const isFailed = log.type === "email_failed";
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 18px",
                        borderBottom: i < recentLogs.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: isSent ? "var(--green-bg)" : isFailed ? "var(--red-bg)" : "var(--accent)",
                        opacity: isSent || isFailed ? 1 : 0.08,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSent ? "var(--green)" : isFailed ? "var(--red)" : "var(--accent)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {isSent ? <polyline points="20 6 9 17 4 12" />
                          : isFailed ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                          : <><circle cx="12" cy="12" r="1" /><path d="M12 8v4M12 16h0" /></>}
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.summary}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.detail}
                        </div>
                      </div>
                      {log.status && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: isSent ? "var(--green-bg)" : "var(--red-bg)",
                          color: isSent ? "var(--green)" : "var(--red)",
                          flexShrink: 0,
                        }}>
                          {log.status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
