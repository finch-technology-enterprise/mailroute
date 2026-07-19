import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import { get, put } from "../api/client";
import type { ApiResponse } from "../types";

interface ConfigRow {
  service: string;
  key: string;
  value: string;
  updated_at: string;
}

export default function Config() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ service: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<ApiResponse<ConfigRow[]>>("/config");
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async (service: string, key: string) => {
    setSaving(true);
    try {
      await put(`/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}`, { value: editValue });
      setRows((prev) => prev.map((r) => r.service === service && r.key === key ? { ...r, value: editValue } : r));
      setEditing(null);
      toast("Config updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <h1 className="mb-8">Service Config</h1>

      {loading ? (
        <div className="card p-8 text-center" style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-8 py-20 text-center">
          <div style={{ width: 48, height: 48, borderRadius: 24, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 20, color: "var(--text-tertiary)" }}>⚙️</div>
          <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>No config rows</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>The service_config table is empty or the endpoint isn't ready yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="apple-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Key</th>
                <th>Value</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.service}-${row.key}`}>
                  <td><span className="code">{row.service}</span></td>
                  <td style={{ fontWeight: 500 }}>{row.key}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {editing?.service === row.service && editing?.key === row.key ? (
                      <div className="flex gap-2" style={{ alignItems: "center" }}>
                        <input className="apple-input" style={{ fontSize: 13, padding: "6px 10px", minHeight: 32 }} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                        <motion.button className="apple-btn apple-btn-primary" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32, whiteSpace: "nowrap" }} onClick={() => handleSave(row.service, row.key)} disabled={saving} whileTap={{ scale: 0.97 }}>Save</motion.button>
                        <motion.button className="apple-btn apple-btn-secondary" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }} onClick={() => setEditing(null)} whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                      </div>
                    ) : (
                      <span className="truncate-text" style={{ maxWidth: 300, display: "inline-block" }}>{row.value}</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button className="apple-link" onClick={() => { setEditing({ service: row.service, key: row.key }); setEditValue(row.value); }}>Edit</button>
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
