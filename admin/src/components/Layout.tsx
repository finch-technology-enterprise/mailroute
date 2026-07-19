import { NavLink, Outlet } from "react-router-dom";
import { hasAuthKey, clearAuthKey } from "../api/client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/vendors", label: "Vendors" },
  { to: "/templates", label: "Templates" },
  { to: "/test-send", label: "Test Send" },
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
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className="card p-10 w-full max-w-sm mx-4"
      >
        <h1 className="mb-1 text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>mailroute</h1>
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
        style={{ fontSize: 13, padding: "8px 12px" }}
        placeholder="New API key"
        value={keyValue}
        onChange={(e) => setKeyValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        autoFocus
      />
      <div className="flex gap-2">
        <motion.button
          className="apple-btn apple-btn-primary"
          style={{ fontSize: 12, padding: "6px 14px", flex: 1 }}
          onClick={handleSave}
          whileTap={{ scale: 0.97 }}
        >
          Save
        </motion.button>
        <motion.button
          className="apple-btn apple-btn-secondary"
          style={{ fontSize: 12, padding: "6px 14px", flex: 1 }}
          onClick={() => { clearAuthKey(); window.location.reload(); }}
          whileTap={{ scale: 0.97 }}
        >
          Disconnect
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function Layout() {
  const [showSettings, setShowSettings] = useState(false);

  if (!hasAuthKey()) return <AuthScreen />;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <nav className="glass-sidebar flex w-60 flex-col px-5 py-8 fixed h-screen z-10">
        <h2 className="mb-10 px-2 text-xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>mailroute</h2>

        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className="relative px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
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
                  <span className="relative z-10" style={{ color: isActive ? "var(--accent)" : undefined, fontWeight: isActive ? 600 : 500 }}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto pt-4 relative">
          <motion.button
            className="apple-btn-ghost w-full justify-start text-sm"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)", padding: "8px 12px", borderRadius: "var(--radius-md)" }}
            onClick={() => setShowSettings(!showSettings)}
            whileTap={{ scale: 0.98 }}
          >
            Settings
          </motion.button>
          <AnimatePresence>
            {showSettings && <SettingsPopover onClose={() => setShowSettings(false)} />}
          </AnimatePresence>
        </div>
      </nav>

      <main className="flex-1 ml-60 p-10">
        <Outlet />
      </main>
    </div>
  );
}
