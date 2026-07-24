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
  env: { D1_DATABASE: D1Database },
  payload: PushPayload,
) {
  try {
    const db = drizzle(env.D1_DATABASE);
    const subs = await db.select().from(PushSubscription).all();
    if (subs.length === 0) return;
    await Promise.allSettled(
      subs.map((sub) =>
        fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
          },
          body: JSON.stringify(payload),
        }).catch(() => {}),
      ),
    );
  } catch {}
}
