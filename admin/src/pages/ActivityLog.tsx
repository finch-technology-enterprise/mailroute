import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { get } from "../api/client";
import type { ApiResponse } from "../types";

interface LogEntry {
  id: string;
  vendor: string;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
  created_at: string;
}

// Votes endpoint — returns empty array until backend exists
export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<ApiResponse<LogEntry[]>>("/logs")
      .then((res) => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <h1 className="mb-8">Activity Log</h1>
      {loading ? (
        <div
          className="card p-8 text-center"
          style={{ color: "var(--text-secondary)", fontSize: 14 }}
        >
          Loading...
        </div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-8 py-20 text-center">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              color: "var(--text-tertiary)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>
            No activity yet
          </h3>
          <p
            className="mb-2"
            style={{ color: "var(--text-secondary)", fontSize: 14 }}
          >
            Send a test email and it will appear here.
          </p>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
            Requires a send_logs table in D1 — coming soon.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="apple-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="code">{log.vendor}</span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{log.to}</td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {log.subject}
                  </td>
                  <td>
                    <span
                      className={`apple-badge ${log.status === "sent" ? "apple-badge-enabled" : "apple-badge-disabled"}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
