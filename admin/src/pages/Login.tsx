import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { login } from "../api/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        navigate("/");
      } else {
        setError(res.message || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px" }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>mailroute</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 14px 0" }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Email</label>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: "100%", border: "none", background: "transparent", padding: "0 14px 12px", fontSize: 15, outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
          />
          <div style={{ height: 1, background: "var(--border)", margin: "0 14px" }} />
          <div style={{ padding: "12px 14px 0" }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Password</label>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none", background: loading ? "#0071e366" : "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginBottom: 12 }}
        >
          {loading ? "Signing in\u2026" : "Sign In"}
        </motion.button>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Link to="/forgot-password" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 13 }}>Forgot password?</Link>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
          No account?{" "}
          <Link to="/signup" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Create one</Link>
        </p>
      </form>
    </motion.div>
  );
}
