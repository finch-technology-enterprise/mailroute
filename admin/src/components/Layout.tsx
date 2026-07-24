import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasAuthKey, clearAuthKey } from "../api/client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Icon from "./Icon";

const navItems = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/vendors", label: "Vendors", icon: "vendors" },
  { to: "/templates", label: "Templates", icon: "templates" },
  { to: "/test-send", label: "Test Send", icon: "test-send" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/config", label: "Config", icon: "config" },
];

function AuthScreen() {
  const [keyValue, setKeyValue] = useState("");

  const handleSubmit = () => {
    if (keyValue) {
      localStorage.setItem("mailroute_api_key", keyValue);
      window.location.reload();
    }
  };

  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      style={{
        background: "var(--bg-primary)",
        paddingTop: "var(--sat)",
        paddingBottom: "var(--sab)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.6 }}
        className="w-full max-w-sm mx-4"
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 20,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-xl)",
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--accent), #5ac8fa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 4px 12px rgba(0, 113, 227, 0.3)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polyline points="2,4 12,13 22,4" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>mailroute</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
          Enter your API auth key to continue.
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            className="apple-input"
            placeholder="API_AUTH_KEY"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            autoComplete="off"
            style={{ fontSize: 16, padding: "12px 14px", borderRadius: 12 }}
          />
          <motion.button
            className="apple-btn apple-btn-primary w-full justify-center"
            onClick={handleSubmit}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", bounce: 0, duration: 0.12 }}
            style={{ padding: "12px 18px", borderRadius: 12, fontSize: 15 }}
          >
            Connect
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const modes = ["light", "auto", "dark"] as const;
  const [mode, setMode] = useState<"light" | "auto" | "dark">(() => {
    const saved = localStorage.getItem("mailroute-theme");
    if (saved === "light" || saved === "dark") return saved;
    return "auto";
  });

  const set = (next: "light" | "auto" | "dark") => {
    setMode(next);
    if (next === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
    localStorage.setItem("mailroute-theme", next);
  };

  if (collapsed) {
    return (
      <motion.button onClick={() => set(modes[(modes.indexOf(mode) + 1) % modes.length])} whileTap={{ scale: 0.95 }} style={{ width: "100%", padding: "8px 0", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", borderRadius: "var(--radius-md)", fontSize: 16 }} aria-label={`Theme: ${mode}`}>
        {mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "◐"}
      </motion.button>
    );
  }

  return (
    <div style={{ display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-primary)" }}>
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => set(m)}
          style={{
            flex: 1,
            padding: "6px 0",
            border: "none",
            background: mode === m ? "var(--accent)" : "transparent",
            color: mode === m ? "#fff" : "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 500,
            transition: "all 0.15s ease",
          }}
        >
          {m === "dark" ? "Dark" : m === "light" ? "Light" : "Auto"}
        </button>
      ))}
    </div>
  );
}

function NavPills({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex flex-col gap-1" style={{ padding: collapsed ? "0 8px" : "0 12px" }}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className="nav-item relative py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            color: "var(--text-secondary)",
            letterSpacing: "-0.01em",
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "10px 0" : "10px 12px",
          }}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "rgba(0, 113, 227, 0.08)" }}
                  transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                />
              )}
              <span
                className="relative z-10 flex items-center"
                style={{
                  gap: collapsed ? 0 : 10,
                  color: isActive ? "var(--accent)" : undefined,
                  fontWeight: isActive ? 600 : 500,
                  flexDirection: collapsed ? "column" : "row",
                  fontSize: collapsed ? 10 : undefined,
                }}
              >
                <Icon name={item.icon as any} size={collapsed ? 22 : 20} />
                {!collapsed && item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      <motion.button
        onClick={() => { clearAuthKey(); window.location.reload(); }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
          alignItems: "center",
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "10px 0" : "10px 12px",
          border: "none",
          background: "transparent",
          color: "var(--red)",
          cursor: "pointer",
          borderRadius: "var(--radius-md)",
          fontWeight: 500,
          flexDirection: collapsed ? "column" : "row",
          fontSize: collapsed ? 10 : 13,
        }}
        aria-label="Sign out"
      >
        <svg width={collapsed ? 22 : 20} height={collapsed ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {!collapsed && "Sign out"}
      </motion.button>
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTo =
    location.pathname === "/admin" || location.pathname === "/admin/"
      ? "/"
      : location.pathname.replace("/admin", "") || "/";

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.slice(0, 6).map((item) => {
          const isActive =
            activeTo === item.to ||
            (item.to !== "/" && activeTo.startsWith(item.to));
          return (
            <motion.button
              key={item.to}
              type="button"
              className={"bottom-nav-item" + (isActive ? " active" : "")}
              onClick={() => navigate(item.to)}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", bounce: 0, duration: 0.12 }}
              style={{ position: "relative" }}
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="bottom-nav-pill"
                  transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                />
              )}
              <span className="bottom-nav-icon">
                <Icon name={item.icon as any} size={20} color={isActive ? "var(--accent)" : undefined} />
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          className="bottom-nav-item"
          onClick={() => { clearAuthKey(); window.location.reload(); }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", bounce: 0, duration: 0.12 }}
          style={{ flex: "0 0 38px", minWidth: 38 }}
          aria-label="Sign out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </motion.button>
      </div>
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mailroute-sidebar") === "collapsed");
  const sidebarW = collapsed ? 64 : 240;

  useEffect(() => {
    const saved = localStorage.getItem("mailroute-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("mailroute-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  if (!hasAuthKey()) return <AuthScreen />;

  return (
    <div
      className="flex min-h-dvh"
      style={{ background: "var(--bg-primary)", paddingTop: "var(--sat)", minWidth: 0, overflowX: "hidden" }}
    >
      <nav
        className="sidebar-nav glass-sidebar flex-col fixed h-screen z-10"
        style={{ width: sidebarW, overflow: "visible", transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div style={{ padding: collapsed ? "28px 0" : "28px 20px 0", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: collapsed ? 24 : 32 }}>
          {collapsed ? (
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>M</span>
          ) : (
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>mailroute</h2>
          )}
        </div>
        <NavPills collapsed={collapsed} />
        <div style={{ marginTop: "auto", padding: collapsed ? "4px 8px" : "4px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <ThemeToggle collapsed={collapsed} />
          <motion.button
            onClick={() => setCollapsed(!collapsed)}
            whileTap={{ scale: 0.95 }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: "100%",
              padding: collapsed ? "10px 0" : "8px 10px",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 10,
              fontSize: 13,
              fontWeight: 500,
              transition: "color 0.15s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : "none", flexShrink: 0 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            {!collapsed && "Collapse sidebar"}
          </motion.button>
        </div>
      </nav>

      <main
        className="flex-1"
        style={{
          marginLeft: sidebarW,
          padding: "40px 36px",
          paddingBottom: 40,
          minWidth: 0,
          transition: "margin-left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          <Outlet />
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
