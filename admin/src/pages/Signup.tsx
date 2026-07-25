import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { signup } from "../api/auth";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", tenantName: "", tenantSlug: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signup(form);
      if (res.success) {
        navigate("/?welcome=1");
      } else {
        setError(res.message || "Signup failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "tenantName", label: "Company Name", type: "text", autoComplete: "organization", placeholder: "My Company" },
    { key: "tenantSlug", label: "Company Slug", type: "text", autoComplete: "off", placeholder: "my-company" },
    { key: "name", label: "Your Name", type: "text", autoComplete: "name", placeholder: "Jane Doe" },
    { key: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "jane@example.com" },
    { key: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "Min. 8 characters" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 420, margin: "60px auto 0", padding: "0 20px" }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>mailroute</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Create your account</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
          {fields.map((f, i) => (
            <div key={f.key}>
              {i > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 14px" }} />}
              <div style={{ padding: "12px 14px 0" }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{f.label}</label>
              </div>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={update(f.key)}
                required
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                style={{ width: "100%", border: "none", background: "transparent", padding: "0 14px 12px", fontSize: 15, outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
              />
            </div>
          ))}
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
          {loading ? "Creating account\u2026" : "Create Account"}
        </motion.button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </p>
      </form>
    </motion.div>
  );
}
