import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import { get, put } from "../api/client";
import { changePassword } from "../api/auth";
import type { ApiResponse } from "../types";

interface TenantSettingsData {
  name: string;
  slug: string;
  settings: Record<string, string>;
}

export default function TenantSettings() {
  const [data, setData] = useState<TenantSettingsData | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const { toast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await get<ApiResponse<TenantSettingsData>>("/tenant/settings");
      if (res.success && res.data) {
        setData(res.data);
        setSettings(res.data.settings);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await put<ApiResponse<null>>("/tenant/settings", { settings });
      if (res.success) {
        toast("Settings saved", "success");
        fetchSettings();
      } else {
        toast(res.message || "Failed to save settings", "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    setSettings((prev) => ({ ...prev, [newKey.trim()]: newValue }));
    setNewKey("");
    setNewValue("");
  };

  const handleRemoveKey = (key: string) => {
    setSettings((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        toast("Password changed successfully", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast(res.message || "Failed to change password", "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <h1 className="mb-1">Settings</h1>
        <div className="flex flex-col gap-3" style={{ marginTop: 28 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton-shimmer" style={{ height: 14, width: "40%", marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "80%" }} />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <h1 className="mb-1">Settings</h1>
      {data && (
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
          {data.name} &middot; {data.slug}
        </p>
      )}

      <div className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Tenant Settings</h2>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <div className="flex flex-col gap-4">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="apple-label">{key}</label>
                  <input
                    className="apple-input"
                    type="text"
                    value={value}
                    onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  style={{
                    marginTop: 20,
                    padding: "6px 10px",
                    border: "none",
                    background: "transparent",
                    color: "var(--red)",
                    cursor: "pointer",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                  onClick={() => handleRemoveKey(key)}
                  aria-label={`Remove ${key}`}
                >
                  Remove
                </motion.button>
              </div>
            ))}
            {Object.keys(settings).length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No settings configured yet.</p>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Add Setting</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="apple-input"
                style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "8px 10px", minHeight: 34 }}
                placeholder="Key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <input
                className="apple-input"
                style={{ flex: 2, minWidth: 160, fontSize: 13, padding: "8px 10px", minHeight: 34 }}
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <motion.button
                className="apple-btn apple-btn-primary"
                style={{ fontSize: 13, padding: "8px 14px", minHeight: 34 }}
                onClick={handleAddKey}
                whileTap={{ scale: 0.97 }}
                disabled={!newKey.trim()}
              >
                Add
              </motion.button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <motion.button
              className="apple-btn apple-btn-primary"
              disabled={saving}
              onClick={handleSave}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", bounce: 0, duration: 0.12 }}
            >
              {saving ? "Saving\u2026" : "Save Settings"}
            </motion.button>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Change Password</h2>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="apple-label">Current Password</label>
              <input
                className="apple-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="apple-label">New Password</label>
              <input
                className="apple-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="apple-label">Confirm New Password</label>
              <input
                className="apple-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end pt-2">
              <motion.button
                type="submit"
                className="apple-btn apple-btn-primary"
                disabled={changingPassword}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", bounce: 0, duration: 0.12 }}
              >
                {changingPassword ? "Saving\u2026" : "Change Password"}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}