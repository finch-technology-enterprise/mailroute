import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { post, del } from "../api/client";

export default function PushSetup() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready.then(() => setSwReady(true));
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub)),
      );
    }
  }, []);

  const subscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BNDkq0l3P7fjVL5lGL5m5xwnR5hLHIx_O5hQnP_IzHik_C1QF1IajNZO7hkqEXBsiLtH0U4i7qDOBiGFQ7R_1Gk",
        ),
      });
      await post("/push/subscribe", sub.toJSON());
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await del("/push/subscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  };

  if (!supported) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: subscribed ? "var(--accent)" : "var(--text-tertiary)" }}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
        {subscribed ? "Push notifications enabled" : "Get notified when emails are sent"}
      </span>
      <motion.button
        className={`apple-btn ${subscribed ? "apple-btn-secondary" : "apple-btn-primary"}`}
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={!swReady}
        whileTap={{ scale: 0.97 }}
        style={{ fontSize: 12, padding: "4px 12px", minHeight: 30 }}
      >
        {subscribed ? "Disable" : "Enable"}
      </motion.button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const chars = rawData.split("").map((c) => c.charCodeAt(0));
  return new Uint8Array(chars);
}
