import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../components/Toast";
import { get, put, post } from "../api/client";
import type { ApiResponse } from "../types";

interface ConfigRow {
  service: string;
  key: string;
  value: string;
  encrypted: boolean;
  updated_at: string;
}

interface NewConfig {
  service: string;
  key: string;
  value: string;
}

const emptyNewConfig: NewConfig = { service: "", key: "", value: "" };

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

const SECRET_PATTERN = /token|key|secret|pass|auth|cred/i;

export default function Config() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ service: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealing, setRevealing] = useState<Set<string>>(new Set());
  const [rotating, setRotating] = useState<Set<string>>(new Set());
  const [hiddenValues, setHiddenValues] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState<NewConfig>(emptyNewConfig);
  const [adding, setAdding] = useState(false);
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

  const grouped = useMemo(() => {
    const filtered = search
      ? rows.filter((r) =>
          r.service.toLowerCase().includes(search.toLowerCase()) ||
          r.key.toLowerCase().includes(search.toLowerCase())
        )
      : rows;
    const map = new Map<string, ConfigRow[]>();
    for (const row of filtered) {
      const list = map.get(row.service) || [];
      list.push(row);
      map.set(row.service, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, search]);

  const handleSave = async (service: string, key: string) => {
    setSaving(true);
    try {
      await put(`/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}`, { value: editValue });
      setRows((prev) =>
        prev.map((r) =>
          r.service === service && r.key === key
            ? { ...r, value: editValue, encrypted: false, updated_at: new Date().toISOString() }
            : r,
        ),
      );
      setEditing(null);
      toast("Config updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEncrypt = async (service: string, key: string) => {
    try {
      await post(`/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}/encrypt`, {});
      setRows((prev) =>
        prev.map((r) =>
          r.service === service && r.key === key
            ? {
                ...r,
                encrypted: true,
                value: r.value.length > 64 ? r.value.slice(0, 20) + "…(encrypted)" : r.value,
              }
            : r,
        ),
      );
      toast("Encrypted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Encryption failed", "error");
    }
  };

  const handleDecrypt = async (service: string, key: string) => {
    const id = `${service}:${key}`;
    setRevealing((prev) => new Set(prev).add(id));
    try {
      const original = rows.find((r) => r.service === service && r.key === key)?.value;
      const res = await post<ApiResponse<{ value: string }>>(
        `/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}/decrypt`, {},
      );
      setHiddenValues((prev) => ({ ...prev, [id]: original || "" }));
      setRevealed((prev) => new Set(prev).add(id));
      setRows((prev) =>
        prev.map((r) =>
          r.service === service && r.key === key
            ? { ...r, value: res.data?.value || r.value }
            : r,
        ),
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Decryption failed", "error");
    } finally {
      setRevealing((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleRotate = async (service: string, key: string) => {
    const id = `${service}:${key}`;
    setRotating((prev) => new Set(prev).add(id));
    try {
      const original = rows.find((r) => r.service === service && r.key === key)?.value;
      const res = await post<ApiResponse<{ value: string }>>(
        `/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}/rotate`, {},
      );
      setHiddenValues((prev) => ({ ...prev, [id]: original || "" }));
      setRows((prev) =>
        prev.map((r) =>
          r.service === service && r.key === key
            ? { ...r, value: res.data?.value || r.value, encrypted: false, updated_at: new Date().toISOString() }
            : r,
        ),
      );
      setRevealed((prev) => new Set(prev).add(id));
      toast("Rotated — new value shown. Copy it now.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rotation failed", "error");
    } finally {
      setRotating((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleAdd = async () => {
    if (!newConfig.service.trim() || !newConfig.key.trim()) return;
    setAdding(true);
    try {
      await post("/config", newConfig);
      setRows((prev) => [
        ...prev,
        {
          service: newConfig.service,
          key: newConfig.key,
          value: newConfig.value,
          encrypted: false,
          updated_at: new Date().toISOString(),
        },
      ]);
      setShowAdd(false);
      setNewConfig(emptyNewConfig);
      toast("Config created", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create", "error");
    } finally {
      setAdding(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied", "success");
    } catch {
      toast("Failed to copy", "error");
    }
  };

  const isSecret = (key: string) => SECRET_PATTERN.test(key);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div className="mb-6 flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="mb-1">Service Config</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {rows.length} value{rows.length !== 1 ? "s" : ""} across {grouped.length} service{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <input
            className="apple-input"
            style={{ width: 200, fontSize: 14, padding: "8px 12px", minHeight: 36 }}
            placeholder="Search keys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={() => setShowAdd(true)}
            whileTap={{ scale: 0.97 }}
          >
            Add Config
          </motion.button>
          <motion.button
            className="apple-btn apple-btn-secondary"
            onClick={fetch}
            whileTap={{ scale: 0.97 }}
            style={{ fontSize: 20, lineHeight: 1, padding: "8px 14px" }}
            title="Refresh"
          >
            ↻
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Loading...
        </div>
      ) : grouped.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-8 py-20 text-center">
          <div style={{ width: 48, height: 48, borderRadius: 24, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: "var(--text-tertiary)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>No config rows</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{search ? "No matching keys." : "Add your first config value to get started."}</p>
          {!search && (
            <motion.button
              className="apple-btn apple-btn-primary mt-6"
              onClick={() => setShowAdd(true)}
              whileTap={{ scale: 0.97 }}
            >
              Add Config
            </motion.button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([service, items]) => (
            <div key={service} className="card overflow-hidden">
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                <span className="code" style={{ fontSize: 13, fontWeight: 600 }}>{service}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 12, marginLeft: 8 }}>{items.length} key{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="table-wrap">
                <table className="apple-table">
                  <tbody>
                    {items.map((row) => {
                      const id = `${row.service}:${row.key}`;
                      const isRevealed = revealed.has(id);
                      const isSecretKey = isSecret(row.key);
                      return (
                        <tr key={id}>
                          <td style={{ width: "30%", fontWeight: 500, whiteSpace: "nowrap" }}>
                            {row.encrypted && (
                              <span title="Encrypted at rest" style={{ marginRight: 6, display: "inline-flex", verticalAlign: "middle" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </span>
                            )}
                            {row.key}
                          </td>
                          <td style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 300, wordBreak: "break-all" }}>
                            {editing?.service === row.service && editing?.key === row.key ? (
                              <div className="flex gap-2" style={{ alignItems: "center" }}>
                                <input
                                  className="apple-input code"
                                  style={{ fontSize: 13, padding: "6px 10px", minHeight: 32, width: 240 }}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  autoFocus
                                />
                                <motion.button
                                  className="apple-btn apple-btn-primary"
                                  style={{ fontSize: 12, padding: "6px 12px", minHeight: 32, whiteSpace: "nowrap" }}
                                  onClick={() => handleSave(row.service, row.key)}
                                  disabled={saving}
                                  whileTap={{ scale: 0.97 }}
                                >
                                  Save
                                </motion.button>
                                <motion.button
                                  className="apple-btn apple-btn-secondary"
                                  style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }}
                                  onClick={() => setEditing(null)}
                                  whileTap={{ scale: 0.97 }}
                                >
                                  Cancel
                                </motion.button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span
                                  className={isRevealed ? "" : "truncate-text"}
                                  style={{
                                    maxWidth: 300,
                                    display: "inline-block",
                                    fontFamily: isSecretKey && !isRevealed ? "inherit" : undefined,
                                  }}
                                >
                                  {row.encrypted && !isRevealed ? row.value : row.value}
                                </span>
                                {!editing && (
                                <button
                                  className="apple-link"
                                  style={{ fontSize: 11, opacity: 0.5, padding: "2px 4px" }}
                                  onClick={() => copyToClipboard(row.value)}
                                  title="Copy value"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", width: 70 }}>
                            {row.updated_at && formatTime(row.updated_at)}
                          </td>
                          <td className="text-right" style={{ width: 180 }}>
                            <div className="flex justify-end gap-1" style={{ flexWrap: "wrap" }}>
                              {!editing && (
                                <button
                                  className="apple-link"
                                  onClick={() => { setEditing({ service: row.service, key: row.key }); setEditValue(row.value); }}
                                >
                                  Edit
                                </button>
                              )}
                              {isSecretKey && !row.encrypted && (
                                <button
                                  className="apple-link"
                                  onClick={() => handleEncrypt(row.service, row.key)}
                                  disabled={revealing.has(id)}
                                >
                                  Encrypt
                                </button>
                              )}
                              {row.encrypted && (
                                <button
                                  className="apple-link"
                                  onClick={() => {
                                    if (isRevealed) {
                                      const masked = hiddenValues[id];
                                      if (masked) setRows((prev) => prev.map((r) => r.service === row.service && r.key === row.key ? { ...r, value: masked } : r));
                                      setRevealed((prev) => { const n = new Set(prev); n.delete(id); return n; });
                                    } else {
                                      handleDecrypt(row.service, row.key);
                                    }
                                  }}
                                  disabled={revealing.has(id)}
                                >
                                  {revealing.has(id) ? "..." : isRevealed ? "Hide" : "Reveal"}
                                </button>
                              )}
                              {isSecretKey && (
                                <button
                                  className="apple-link"
                                  onClick={() => handleRotate(row.service, row.key)}
                                  disabled={rotating.has(id)}
                                >
                                  {rotating.has(id) ? "..." : "Rotate"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="modal-overlay"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="modal-surface"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-6">Add Config</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-5">
                <div>
                  <label className="apple-label">Service</label>
                  <input
                    className="apple-input code"
                    value={newConfig.service}
                    onChange={(e) => setNewConfig((p) => ({ ...p, service: e.target.value }))}
                    required
                    placeholder="e.g., email-microservice or *"
                  />
                  <p className="apple-hint">Use <code>*</code> for values shared across all services.</p>
                </div>
                <div>
                  <label className="apple-label">Key</label>
                  <input
                    className="apple-input code"
                    value={newConfig.key}
                    onChange={(e) => setNewConfig((p) => ({ ...p, key: e.target.value }))}
                    required
                    placeholder="e.g., API_AUTH_KEY"
                  />
                </div>
                <div>
                  <label className="apple-label">Value</label>
                  <textarea
                    className="apple-input code"
                    rows={3}
                    value={newConfig.value}
                    onChange={(e) => setNewConfig((p) => ({ ...p, value: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="apple-btn apple-btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</button>
                  <motion.button type="submit" className="apple-btn apple-btn-primary" disabled={adding} whileTap={{ scale: 0.97 }}>
                    {adding ? "Saving..." : "Save"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
