import { useId, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { login } from "../api/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

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

  // Form field animation config
  const springConfig = {
    type: "spring",
    bounce: 0,
    duration: shouldReduce ? 0 : 0.35,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduce ? 0.1 : 0.25 }}
      style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px" }}
    >
      {/* Logo + branding — scale-in with subtle overshoot */}
      <motion.div
        initial={
          shouldReduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          bounce: 0.15,
          duration: shouldReduce ? 0 : 0.45,
        }}
        style={{ textAlign: "center", marginBottom: 32 }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          mailroute
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
          Sign in to your account
        </p>
      </motion.div>

      <form onSubmit={handleSubmit}>
        {/* Form container — glass surface */}
        <motion.div
          initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: shouldReduce ? 0 : 0.4,
            delay: shouldReduce ? 0 : 0.05,
          }}
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          {/* Email field */}
          <motion.div
            animate={{
              background:
                focused === "email" ? "rgba(0,113,227,0.04)" : "transparent",
            }}
            transition={{ duration: shouldReduce ? 0 : 0.15 }}
            style={{ padding: "12px 14px 0" }}
          >
            <label
              htmlFor={emailId}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  focused === "email"
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                transition: shouldReduce ? "none" : "color 0.15s ease",
                display: "block",
              }}
            >
              Email
            </label>
          </motion.div>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            required
            autoComplete="email"
            aria-describedby={error ? errorId : undefined}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              padding: "0 14px 12px",
              fontSize: 15,
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              transition: shouldReduce ? "none" : "color 0.15s ease",
            }}
          />
          <motion.div
            animate={{ height: 1, opacity: 1 }}
            style={{
              height: 1,
              background:
                focused === "email" ? "var(--accent)" : "var(--border)",
              transition: shouldReduce ? "none" : "background 0.15s ease",
              margin: "0 14px",
            }}
          />

          {/* Password field */}
          <motion.div
            animate={{
              background:
                focused === "password" ? "rgba(0,113,227,0.04)" : "transparent",
            }}
            transition={{ duration: shouldReduce ? 0 : 0.15 }}
            style={{ padding: "12px 14px 0" }}
          >
            <label
              htmlFor={passwordId}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  focused === "password"
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                transition: shouldReduce ? "none" : "color 0.15s ease",
                display: "block",
              }}
            >
              Password
            </label>
          </motion.div>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              padding: "0 14px 12px",
              fontSize: 15,
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
        </motion.div>

        {/* Error message — shake if present */}
        {error && (
          <motion.div
            id={errorId}
            role="alert"
            initial={
              shouldReduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              bounce: 0.2,
              duration: shouldReduce ? 0 : 0.35,
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,69,58,0.1)",
              color: "#c0392b",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Submit button — full-width, prominent */}
        <motion.button
          type="submit"
          disabled={loading}
          whileTap={loading || shouldReduce ? {} : { scale: 0.97 }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: shouldReduce ? 0 : 0.15,
          }}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: loading ? "#0071e366" : "var(--accent)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 12,
            transition: shouldReduce
              ? "none"
              : "background 0.15s ease, opacity 0.15s ease",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </motion.button>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Link
            to="/forgot-password"
            style={{
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontSize: 13,
              transition: shouldReduce ? "none" : "color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseOut={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Forgot password?
          </Link>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          No account?{" "}
          <Link
            to="/signup"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: 500,
              transition: shouldReduce ? "none" : "opacity 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Create one
          </Link>
        </p>
      </form>
    </motion.div>
  );
}
