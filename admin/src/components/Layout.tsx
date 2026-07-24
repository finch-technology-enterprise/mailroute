import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasToken, clearToken, hasAuthKey, clearAuthKey } from "../api/client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Icon from "./Icon";

const navItems = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/vendors", label: "Vendors", icon: "vendors" },
  { to: "/templates", label: "Templates", icon: "templates" },
  { to: "/test-send", label: "Test Send", icon: "test-send" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/api-keys", label: "API Keys", icon: "key" },
  { to: "/settings", label: "Settings", icon: "config" },
];

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
        {mode === "dark" ? "\u{1F319}" : mode === "light" ? "\u2600\uFE0F" : "\u25D0"}
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
        onClick={() => { clearToken(); clearAuthKey(); window.location.href = "/login"; }}
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
        {navItems.map((item) => {
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
              style={{
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
              }}
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
                  textAlign: "center",
                }}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("mailroute-sidebar") === "collapsed");
  const sidebarW = collapsed ? 64 : 240;

  useEffect(() => {
    const saved = localStorage.getItem("mailroute-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("mailroute-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  const authenticated = hasToken() || hasAuthKey();

  useEffect(() => {
    if (!authenticated) {
      navigate("/login", { replace: true });
    }
  }, [authenticated, navigate]);

  if (!authenticated) return null;

  return (
    <div
      className="flex h-dvh overflow-hidden"
      style={{ background: "var(--bg-primary)", paddingTop: "var(--sat)", minWidth: 0 }}
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
        className="flex-1 overflow-y-auto"
        style={{
          marginLeft: sidebarW,
          padding: "40px 36px",
          paddingBottom: 40,
          minWidth: 0,
          transition: "margin-left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ position: "relative" }}>
          <motion.button
            className="mobile-signout"
            onClick={() => { clearToken(); clearAuthKey(); window.location.href = "/login"; }}
            whileTap={{ scale: 0.93 }}
            aria-label="Sign out"
            style={{
              position: "absolute",
              top: -8,
              right: 0,
              zIndex: 20,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              borderRadius: "var(--radius-md)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </motion.button>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
