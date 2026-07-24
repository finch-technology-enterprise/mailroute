import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { get } from "../api/client";
import type { ApiResponse } from "../types";
import PushSetup from "../components/PushSetup";
import EmptyState from "../components/EmptyState";
import AnimatedPage from "../components/AnimatedPage";
import Skeleton from "../components/Skeleton";

interface LogEntry {
  id: string;
  type: string;
  summary: string;
  detail: string | null;
  status: string | null;
  createdAt: string;
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getBadge(type: string, status: string | null) {
  if (type.startsWith("email_")) {
    const ok = status === "sent";
    return {
      bg: ok ? "var(--green-bg)" : "var(--red-bg)",
      color: ok ? "var(--green)" : "var(--red)",
      icon: ok
        ? '<polyline points="20 6 9 17 4 12"/>'
        : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    };
  }
  return {
    bg: "color-mix(in srgb, var(--accent) 12%, transparent)",
    color: "var(--accent)",
    icon:
      type.startsWith("vendor_")
        ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
        : type.startsWith("template_")
          ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
          : '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    get<ApiResponse<LogEntry[]>>("/logs")
      .then((res) => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.summary.toLowerCase().includes(q) ||
      (log.detail || "").toLowerCase().includes(q)
    );
  });

  return (
    <AnimatedPage>
      <div className="mb-6">
        <h1 className="mb-1">Activity Log</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {loading ? "Loading..." : `${filtered.length} entr${filtered.length !== 1 ? "ies" : "y"}`}
        </p>
      </div>

      {!loading && logs.length > 0 && (
        <div className="mb-5">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "8px 14px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: "var(--text-primary)",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-6 flex flex-col gap-4">
          <Skeleton count={5} height={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching activity" : "No activity yet"}
          description={search ? "Try a different search term." : "Activity from the app will appear here."}
        />
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((log, i) => {
            const badge = getBadge(log.type, log.status);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.35, delay: i * 0.04 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: badge.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={badge.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: badge.icon }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.summary}
                  </div>
                  {log.detail && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>
                      {log.detail}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {formatTime(log.createdAt)}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
      <PushSetup />
    </AnimatedPage>
  );
}
