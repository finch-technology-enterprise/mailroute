import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { hasAuthKey, clearAuthKey } from "../api/client";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/vendors", label: "Vendors" },
  { to: "/templates", label: "Templates" },
  { to: "/test-send", label: "Test Send" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  const handleLogout = () => {
    clearAuthKey();
    window.location.reload();
  };

  const handleKeyUpdate = () => {
    if (keyValue) {
      localStorage.setItem("mailroute_api_key", keyValue);
      setShowKeyInput(false);
      setKeyValue("");
    }
  };

  if (!hasAuthKey()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
          <h1 className="mb-6 text-xl font-semibold">mailroute Admin</h1>
          <p className="mb-4 text-sm text-gray-600">
            Enter your API auth key to continue.
          </p>
          <input
            type="password"
            className="mb-4 w-full rounded border px-3 py-2 text-sm"
            placeholder="API_AUTH_KEY"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleKeyUpdate()}
          />
          <button
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleKeyUpdate}
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 flex-col border-r bg-white px-4 py-6">
        <h1 className="mb-8 px-2 text-lg font-bold text-gray-800">mailroute</h1>
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            className="rounded px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            Settings
          </button>
          {showKeyInput && (
            <div className="rounded border p-3">
              <input
                type="password"
                className="mb-2 w-full rounded border px-2 py-1 text-xs"
                placeholder="New API key"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
              />
              <button
                className="mr-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                onClick={handleKeyUpdate}
              >
                Save
              </button>
              <button
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                onClick={handleLogout}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
