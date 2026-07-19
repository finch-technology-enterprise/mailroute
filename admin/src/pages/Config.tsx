import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
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

export default function Config() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ service: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealing, setRevealing] = useState<Set<string>>(new Set());
  const [rotating, setRotating] = useState<Set<string>>(new Set());
  const [hiddenValues, setHiddenValues] = useState<Record<string, string>>({});
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
      setRows((prev) => prev.map((r) => r.service === service && r.key === key ? { ...r, value: editValue, encrypted: false } : r));
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
      setRows((prev) => prev.map((r) => r.service === service && r.key === key ? { ...r, encrypted: true, value: r.value.length > 64 ? r.value.slice(0, 20) + "…(encrypted)" : r.value } : r));
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
      setRows((prev) => prev.map((r) => r.service === service && r.key === key ? { ...r, value: res.data?.value || r.value } : r));
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
      setRows((prev) => prev.map((r) => r.service === service && r.key === key ? { ...r, value: res.data?.value || r.value, encrypted: false } : r));
      setRevealed((prev) => new Set(prev).add(id));
      toast("Rotated — new value shown below. Copy it now.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rotation failed", "error");
    } finally {
      setRotating((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const isSecret = (key: string) => /token|key|secret|pass|auth|cred/i.test(key);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <h1 className="mb-3">Service Config</h1>
      <p className="mb-8" style={{ color: "var(--text-secondary)", fontSize: 14 }}>Manage configuration values. Sensitive keys can be encrypted at rest with AES-GCM and rotated.</p>

      {loading ? (
        <div className="card p-8 text-center" style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-8 py-20 text-center">
          <div style={{ width: 48, height: 48, borderRadius: 24, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 20, color: "var(--text-tertiary)" }}>⚙️</div>
          <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>No config rows</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>The service_config table is empty.</p>
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
              {rows.map((row) => {
                const id = `${row.service}:${row.key}`;
                const isRevealed = revealed.has(id);
                const isSecretKey = isSecret(row.key);
                return (
                  <tr key={id}>
                    <td><span className="code" style={{ fontSize: 12 }}>{row.service}</span></td>
                    <td style={{ fontWeight: 500 }}>
                      {row.encrypted && <span title="Encrypted at rest" style={{ marginRight: 6 }}>🔒</span>}
                      {row.key}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 300, wordBreak: "break-all" }}>
                      {editing?.service === row.service && editing?.key === row.key ? (
                        <div className="flex gap-2" style={{ alignItems: "center" }}>
                          <input className="apple-input code" style={{ fontSize: 13, padding: "6px 10px", minHeight: 32, width: 240 }} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                          <motion.button className="apple-btn apple-btn-primary" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32, whiteSpace: "nowrap" }} onClick={() => handleSave(row.service, row.key)} disabled={saving} whileTap={{ scale: 0.97 }}>Save</motion.button>
                          <motion.button className="apple-btn apple-btn-secondary" style={{ fontSize: 12, padding: "6px 12px", minHeight: 32 }} onClick={() => setEditing(null)} whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                        </div>
                      ) : (
                        <span className={isRevealed ? "" : "truncate-text"} style={{ maxWidth: 300, display: "inline-block", fontFamily: isSecretKey ? "inherit" : undefined }}>
                          {row.encrypted && !isRevealed ? row.value : row.value}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1" style={{ flexWrap: "wrap" }}>
                        {!editing && (
                          <button className="apple-link" onClick={() => { setEditing({ service: row.service, key: row.key }); setEditValue(row.value); }}>Edit</button>
                        )}
                        {isSecretKey && !row.encrypted && (
                          <button className="apple-link" onClick={() => handleEncrypt(row.service, row.key)} disabled={revealing.has(id)}>Encrypt</button>
                        )}
                        {row.encrypted && (
                          <button className="apple-link" onClick={() => {
                            if (isRevealed) {
                              const masked = hiddenValues[id];
                              if (masked) {
                                setRows((prev) => prev.map((r) => r.service === row.service && r.key === row.key ? { ...r, value: masked } : r));
                              }
                              setRevealed((prev) => { const n = new Set(prev); n.delete(id); return n; });
                            } else {
                              handleDecrypt(row.service, row.key);
                            }
                          }} disabled={revealing.has(id)}>
                            {revealing.has(id) ? "..." : isRevealed ? "Hide" : "Reveal"}
                          </button>
                        )}
                        {isSecretKey && (
                          <button className="apple-link" onClick={() => handleRotate(row.service, row.key)} disabled={rotating.has(id)}>
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
      )}
    </motion.div>
  );
}
