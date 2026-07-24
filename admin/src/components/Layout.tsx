import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasAuthKey, clearAuthKey } from "../api/client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>",
  },
  {
    to: "/vendors",
    label: "Vendors",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>",
  },
  {
    to: "/templates",
    label: "Templates",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>",
  },
  {
    to: "/test-send",
    label: "Test Send",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 2L11 13'/><path d='M22 2L15 22l-4-9-9-4z'/></svg>",
  },
  {
    to: "/activity",
    label: "Activity",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='22 12 18 12 15 21 9 3 6 12 2 12'/></svg>",
  },
  {
    to: "/config",
    label: "Config",
    icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/></svg>",
  },
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

function SettingsPopover({ onClose }: { onClose: () => void }) {
  const [keyValue, setKeyValue] = useState("");
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark",
  );

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light",
    );
    localStorage.setItem("mailroute-theme", next ? "dark" : "light");
  };

  const handleSave = () => {
    if (keyValue) {
      localStorage.setItem("mailroute_api_key", keyValue);
      setKeyValue("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      className="card p-4"
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: 8,
      }}
    >
      <motion.button
        className="w-full flex items-center gap-3 rounded-lg transition-colors mb-3"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-primary)",
          padding: "8px 12px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
        }}
        onClick={toggleDark}
        whileTap={{ scale: 0.97 }}
      >
        {dark ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        {dark ? "Light Mode" : "Dark Mode"}
      </motion.button>
      <input
        type="password"
        className="apple-input mb-2"
        style={{ fontSize: 16, padding: "8px 12px" }}
        placeholder="New API key"
        value={keyValue}
        onChange={(e) => setKeyValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        autoFocus
        autoComplete="off"
      />
      <div className="flex gap-2">
        <motion.button
          className="apple-btn apple-btn-primary"
          style={{ fontSize: 13, padding: "6px 14px", flex: 1, minHeight: 36 }}
          onClick={handleSave}
          whileTap={{ scale: 0.97 }}
        >
          Save
        </motion.button>
        <motion.button
          className="apple-btn apple-btn-secondary"
          style={{ fontSize: 13, padding: "6px 14px", flex: 1, minHeight: 36 }}
          onClick={() => {
            clearAuthKey();
            window.location.reload();
          }}
          whileTap={{ scale: 0.97 }}
        >
          Disconnect
        </motion.button>
      </div>
    </motion.div>
  );
}

function NavPills() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className="nav-item relative px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)", letterSpacing: "-0.01em" }}
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
                  className="relative z-10 flex items-center gap-3"
                  style={{
                    color: isActive ? "var(--accent)" : undefined,
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                  />
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto pt-4 relative">
        <motion.button
          className="nav-item w-full flex items-center gap-3 text-sm rounded-lg transition-colors"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-tertiary)",
            padding: "10px 12px",
          }}
          onClick={() => setShowSettings(!showSettings)}
          whileTap={{ scale: 0.98 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Settings
        </motion.button>
        <AnimatePresence>
          {showSettings && (
            <SettingsPopover onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>
      </div>
    </>
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
            <button
              key={item.to}
              type="button"
              className="bottom-nav-item"
              onClick={() => navigate(item.to)}
              style={{ position: "relative" }}
            >
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="bottom-nav-pill"
                  transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                />
              )}
              <span className="bottom-nav-icon" style={{ position: "relative", zIndex: 1 }}>
                <span
                  dangerouslySetInnerHTML={{ __html: item.icon }}
                  style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "var(--accent)" : undefined }}
                />
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("mailroute-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  if (!hasAuthKey()) return <AuthScreen />;

  return (
    <div
      className="flex min-h-dvh"
      style={{ background: "var(--bg-primary)", paddingTop: "var(--sat)" }}
    >
      <nav
        className="sidebar-nav glass-sidebar flex-col px-5 py-8 fixed h-screen z-10"
        style={{ width: "var(--sidebar-width)" }}
      >
        <h2
          className="mb-10 px-3"
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}
        >
          mailroute
        </h2>
        <NavPills />
      </nav>

      <main
        className="flex-1"
        style={{
          marginLeft: "var(--sidebar-width)",
          padding: "40px 36px",
          paddingBottom: 40,
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
