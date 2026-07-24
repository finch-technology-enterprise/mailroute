import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { get, put, post, del } from "../api/client";
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
  const [deleteTarget, setDeleteTarget] = useState<{ service: string; key: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
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
            ? { ...r, encrypted: true, value: r.value.length > 64 ? r.value.slice(0, 20) + "…(encrypted)" : r.value }
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
      const res = await post<ApiResponse<{ value: string }>>(`/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}/decrypt`, {});
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
      const res = await post<ApiResponse<{ value: string }>>(`/config/${encodeURIComponent(service)}/${encodeURIComponent(key)}/rotate`, {});
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
      setRows((prev) => [...prev, { service: newConfig.service, key: newConfig.key, value: newConfig.value, encrypted: false, updated_at: new Date().toISOString() }]);
      setShowAdd(false);
      setNewConfig(emptyNewConfig);
      toast("Config created", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`/config/${encodeURIComponent(deleteTarget.service)}/${encodeURIComponent(deleteTarget.key)}`);
      setRows((prev) => prev.filter((r) => r.service !== deleteTarget.service || r.key !== deleteTarget.key));
      setDeleteTarget(null);
      toast("Config deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
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
      <div className="mb-6 flex items-start justify-between" style={{ flexDirection: "column", gap: 12 }}>
        <div>
          <h1 className="mb-1">Config</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {rows.length} value{rows.length !== 1 ? "s" : ""} across {grouped.length} service{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 w-full" style={{ flexWrap: "wrap" }}>
          <input
            className="apple-input"
            style={{ flex: 1, minWidth: 160, fontSize: 14, padding: "8px 12px", minHeight: 36 }}
            placeholder="Search keys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={() => setShowAdd(true)}
            whileTap={{ scale: 0.97 }}
            style={{ whiteSpace: "nowrap" }}
          >
            Add
          </motion.button>
          <motion.button
            className="apple-btn apple-btn-secondary"
            onClick={fetch}
            whileTap={{ scale: 0.97 }}
            style={{ fontSize: 18, lineHeight: 1, padding: "8px 12px" }}
            title="Refresh"
          >
            ↻
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton-shimmer" style={{ height: 14, width: "40%", marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "80%" }} />
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          title={search ? "No matching keys" : "No config rows"}
          description={search ? "Try a different search term." : "Add your first config value to get started."}
          actionLabel={search ? undefined : "Add Config"}
          onAction={search ? undefined : () => setShowAdd(true)}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([service, items]) => (
            <div key={service} className="card overflow-hidden">
              <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-secondary)", textTransform: "uppercase" }}>{service === "*" ? "Shared" : service}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 11, marginLeft: 8 }}>{items.length} key{items.length !== 1 ? "s" : ""}</span>
              </div>
              <table className="apple-table table-as-cards">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th style={{ width: 60 }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const id = `${row.service}:${row.key}`;
                    const isRevealed = revealed.has(id);
                    const isSecretKey = isSecret(row.key);
                    const isEditing = editing?.service === row.service && editing?.key === row.key;
                    return (
                      <Fragment key={id}><tr className="card-hover">
                        <td data-label="Key" style={{ fontWeight: 500 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {row.encrypted && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            )}
                            <span className="truncate-text" style={{ maxWidth: 200 }} title={row.key}>{row.key}</span>
                          </div>
                        </td>
                        <td data-label="Value" style={{ color: "var(--text-secondary)", fontSize: 13, wordBreak: "break-all" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <input className="apple-input code" style={{ fontSize: 13, padding: "6px 10px", minHeight: 32, flex: 1, minWidth: 140 }} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                              <div style={{ display: "flex", gap: 4 }}>
                                <motion.button className="apple-btn apple-btn-primary" style={{ fontSize: 12, padding: "6px 10px", minHeight: 32 }} onClick={() => handleSave(row.service, row.key)} disabled={saving} whileTap={{ scale: 0.97 }}>Save</motion.button>
                                <motion.button className="apple-btn apple-btn-secondary" style={{ fontSize: 12, padding: "6px 10px", minHeight: 32 }} onClick={() => setEditing(null)} whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className={isRevealed ? "" : "truncate-text"} style={{ maxWidth: 260, display: "inline-block" }} title={row.value}>
                                {row.encrypted && !isRevealed ? row.value : row.value}
                              </span>
                              <button className="apple-link" style={{ fontSize: 11, opacity: 0.4, padding: "2px", flexShrink: 0 }} onClick={() => copyToClipboard(row.value)} title="Copy value">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                        <td data-label="Updated" style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                          {row.updated_at && formatTime(row.updated_at)}
                        </td>
                      </tr>
                      <tr key={`${id}-actions`} className="no-card" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={3} style={{ padding: "4px 16px 12px", border: "none" }}>
                          {isEditing ? null : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button className="apple-btn" style={{ fontSize: 12, padding: "4px 10px", minHeight: 28, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} onClick={() => { setEditing({ service: row.service, key: row.key }); setEditValue(row.value); }}>Edit</button>
                              {isSecretKey && !row.encrypted && (
                                <button className="apple-btn" style={{ fontSize: 12, padding: "4px 10px", minHeight: 28, background: "var(--bg-primary)", color: "var(--accent)", border: "1px solid var(--border)" }} onClick={() => handleEncrypt(row.service, row.key)} disabled={revealing.has(id)}>Encrypt</button>
                              )}
                              {row.encrypted && (
                                <button className="apple-btn" style={{ fontSize: 12, padding: "4px 10px", minHeight: 28, background: "var(--bg-primary)", color: "var(--accent)", border: "1px solid var(--border)" }} onClick={() => {
                                  if (isRevealed) {
                                    const masked = hiddenValues[id];
                                    if (masked) setRows((prev) => prev.map((r) => r.service === row.service && r.key === row.key ? { ...r, value: masked } : r));
                                    setRevealed((prev) => { const n = new Set(prev); n.delete(id); return n; });
                                  } else { handleDecrypt(row.service, row.key); }
                                }} disabled={revealing.has(id)}>
                                  {revealing.has(id) ? "..." : isRevealed ? "Hide" : "Reveal"}
                                </button>
                              )}
                              {isSecretKey && (
                                <button className="apple-btn" style={{ fontSize: 12, padding: "4px 10px", minHeight: 28, background: "var(--bg-primary)", color: "var(--orange)", border: "1px solid var(--border)" }} onClick={() => handleRotate(row.service, row.key)} disabled={rotating.has(id)}>
                                  {rotating.has(id) ? "..." : "Rotate"}
                                </button>
                              )}
                              <button className="apple-btn" style={{ fontSize: 12, padding: "4px 10px", minHeight: 28, background: "var(--bg-primary)", color: "var(--red)", border: "1px solid var(--border)" }} onClick={() => setDeleteTarget({ service: row.service, key: row.key })}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr></Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="modal-overlay" onClick={() => setShowAdd(false)}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="modal-surface"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-6">Add Config</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-5">
                <div>
                  <label className="apple-label">Service</label>
                  <input className="apple-input code" value={newConfig.service} onChange={(e) => setNewConfig((p) => ({ ...p, service: e.target.value }))} required placeholder="e.g., email-microservice or *" />
                  <p className="apple-hint">Use <code>*</code> for values shared across all services.</p>
                </div>
                <div>
                  <label className="apple-label">Key</label>
                  <input className="apple-input code" value={newConfig.key} onChange={(e) => setNewConfig((p) => ({ ...p, key: e.target.value }))} required placeholder="e.g., API_AUTH_KEY" />
                </div>
                <div>
                  <label className="apple-label">Value</label>
                  <textarea className="apple-input code" rows={3} value={newConfig.value} onChange={(e) => setNewConfig((p) => ({ ...p, value: e.target.value }))} required />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="apple-btn apple-btn-secondary" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</button>
                  <motion.button type="submit" className="apple-btn apple-btn-primary" disabled={adding} whileTap={{ scale: 0.97 }}>{adding ? "Saving..." : "Save"}</motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Config"
        message={`Delete "${deleteTarget?.key}" for service "${deleteTarget?.service}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleting}
      />
    </motion.div>
  );
}
