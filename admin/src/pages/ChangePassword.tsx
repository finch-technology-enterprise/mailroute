import { useState } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import AnimatedPage from "../components/AnimatedPage";
import { changePassword } from "../api/auth";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    setChanging(true);
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
      setChanging(false);
    }
  };

  return (
    <AnimatedPage>
      <h1 className="mb-1">Settings</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
        Change your account password
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Change Password</h2>
        </div>
        <div style={{ padding: "18px 20px" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
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
                disabled={changing}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", bounce: 0, duration: 0.12 }}
              >
                {changing ? "Saving\u2026" : "Change Password"}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </AnimatedPage>
  );
}
