import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { authRequest } from "../api/client";
import type { ApiResponse } from "../types";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authRequest<ApiResponse>("POST", "/reset-password", { token, password });
      if (res.success) {
        setDone(true);
        redirectTimer.current = setTimeout(() => navigate("/login"), 3000);
      } else {
        setError(res.message || "Reset failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px", textAlign: "center" }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Invalid link</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
          This password reset link is missing or invalid.
        </p>
        <Link to="/forgot-password" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
          Request a new reset link
        </Link>
      </motion.div>
    );
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px", textAlign: "center" }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Password reset</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
          Your password has been reset successfully. Redirecting to sign in\u2026
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px" }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>mailroute</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Choose a new password</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 14px 0" }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>New Password</label>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            style={{ width: "100%", border: "none", background: "transparent", padding: "0 14px 12px", fontSize: 15, outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
          />
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,69,58,0.1)", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none", background: loading ? "#0071e366" : "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginBottom: 16 }}
        >
          {loading ? "Resetting\u2026" : "Reset Password"}
        </motion.button>
      </form>
    </motion.div>
  );
}
