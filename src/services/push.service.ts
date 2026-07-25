import { drizzle } from "drizzle-orm/d1";
import { PushSubscription } from "../db/schema";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  env: { D1_DATABASE: D1Database; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_CONTACT_EMAIL?: string },
  payload: PushPayload,
) {
  try {
    const db = drizzle(env.D1_DATABASE);
    const subs = await db.select().from(PushSubscription).all();
    if (subs.length === 0) return;

    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;

    await Promise.allSettled(
      subs.map(async (sub) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          TTL: "86400",
        };

        if (vapidPrivateKey && vapidPublicKey) {
          const now = Math.floor(Date.now() / 1000);
          const header = { alg: "ES256", typ: "JWT" };
          const payload = {
            aud: new URL(sub.endpoint).origin,
            exp: now + 86400,
            sub: env.VAPID_CONTACT_EMAIL || "mailto:admin@mailroute.dev",
          };

          function toBase64url(buf: Uint8Array): string {
            let binary = "";
            for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
            return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
          }

          const enc = new TextEncoder();
          const headerB64 = toBase64url(enc.encode(JSON.stringify(header)));
          const payloadB64 = toBase64url(enc.encode(JSON.stringify(payload)));
          const signingInput = `${headerB64}.${payloadB64}`;

          const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

          const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            privateKeyBytes.buffer,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["sign"]
          );

          const signature = await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            privateKey,
            enc.encode(signingInput)
          );

          const sigB64 = toBase64url(new Uint8Array(signature));
          headers["Authorization"] = `vapid t=${signingInput}.${sigB64}, k=${vapidPublicKey}`;
        }

        return fetch(sub.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      }),
    );
  } catch {}
}
