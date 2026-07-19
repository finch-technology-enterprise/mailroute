import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasAuthKey, clearAuthKey } from "../api/client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const navItems = [
  { to: "/", label: "Dashboard", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg>" },
  { to: "/vendors", label: "Vendors", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>" },
  { to: "/templates", label: "Templates", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>" },
  { to: "/test-send", label: "Test Send", icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 2L11 13'/><path d='M22 2L15 22l-4-9-9-4z'/></svg>" },
];

function AuthScreen() {
  const [keyValue, setKeyValue] = useState("");

  const handleSubmit = () => {
    if (keyValue) {
      localStorage.setItem("mailroute_api_key", keyValue);
      setKeyValue("");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center" style={{ background: "var(--bg-primary)", paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className="card p-10 w-full max-w-sm mx-4"
      >
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <polyline points="2,4 12,13 22,4"/>
          </svg>
        </div>
        <h1 className="mb-1" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>mailroute</h1>
        <p className="mb-8" style={{ color: "var(--text-secondary)", fontSize: 14 }}>Enter your API auth key to continue.</p>
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
          />
          <motion.button
            className="apple-btn apple-btn-primary w-full justify-center"
            onClick={handleSubmit}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", bounce: 0, duration: 0.15 }}
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
      className="card p-4 mb-2"
      style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 8 }}
    >
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
          onClick={() => { clearAuthKey(); window.location.reload(); }}
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
                <span className="relative z-10 flex items-center gap-3" style={{ color: isActive ? "var(--accent)" : undefined, fontWeight: isActive ? 600 : 500 }}>
                  <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
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
          style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)", padding: "10px 12px" }}
          onClick={() => setShowSettings(!showSettings)}
          whileTap={{ scale: 0.98 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          Settings
        </motion.button>
        <AnimatePresence>
          {showSettings && <SettingsPopover onClose={() => setShowSettings(false)} />}
        </AnimatePresence>
      </div>
    </>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTo = location.pathname === "/admin" || location.pathname === "/admin/" ? "/" : location.pathname.replace("/admin", "") || "/";

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) => {
          const isActive = activeTo === item.to || (item.to !== "/" && activeTo.startsWith(item.to));
          return (
            <button
              key={item.to}
              type="button"
              className={`bottom-nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.to)}
            >
              <motion.span
                className="bottom-nav-icon"
                dangerouslySetInnerHTML={{ __html: item.icon }}
                animate={{ scale: isActive ? 1.05 : 1 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              />
              <motion.span
                animate={{ y: isActive ? -1 : 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}
              >
                {item.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();

  if (!hasAuthKey()) return <AuthScreen />;

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg-primary)", paddingTop: "var(--sat)" }}>
      <nav className="sidebar-nav glass-sidebar flex-col px-5 py-8 fixed h-screen z-10" style={{ width: "var(--sidebar-width)" }}>
        <h2 className="mb-10 px-3" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>mailroute</h2>
        <NavPills />
      </nav>

      <main className="flex-1" style={{ marginLeft: "var(--sidebar-width)", padding: "40px 36px", paddingBottom: 40 }}>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
