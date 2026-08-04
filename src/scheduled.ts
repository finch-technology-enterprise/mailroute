import { drizzle } from "drizzle-orm/d1";
import { eq, and, or, lt, lte } from "drizzle-orm";
import { ScheduledEmail } from "./db/schema";
import { EmailVendorService } from "./services/email-vendor.service";
import { ADAPTERS } from "./vendors";
import type { CloudflareBindings } from "./lib/cloudflare.binding";
import type { EmailPayload } from "./services/email.service";
import { withTimeout, VENDOR_TIMEOUT_MS } from "./utils/timeout.util";

// Well past VENDOR_TIMEOUT_MS: only reclaims rows whose isolate was killed
// mid-send (crash), not ones still legitimately in flight.
const STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function scheduled(
  _event: ScheduledEvent,
  env: CloudflareBindings,
  ctx: ExecutionContext,
): Promise<void> {
  const db = drizzle(env.D1_DATABASE);
  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const candidates = await db
    .select()
    .from(ScheduledEmail)
    .where(
      and(
        lte(ScheduledEmail.sendAt, now),
        or(
          eq(ScheduledEmail.status, "pending"),
          and(
            eq(ScheduledEmail.status, "processing"),
            lt(ScheduledEmail.lockedAt, staleCutoff),
          ),
        ),
      ),
    )
    .all();

  for (const item of candidates) {
    if (item.attempt >= MAX_ATTEMPTS) {
      ctx.waitUntil(
        db
          .update(ScheduledEmail)
          .set({
            status: "failed",
            error: "Max attempts exceeded",
            updatedAt: now,
          })
          .where(eq(ScheduledEmail.id, item.id))
          .execute(),
      );
      continue;
    }

    // Atomically claim the row: only proceed if it's still in the exact
    // state we just read it in. This is what stops the next cron tick (or a
    // stale-lock reclaim) from picking up the same item while a send is
    // already in flight for it.
    const claim = await db
      .update(ScheduledEmail)
      .set({
        status: "processing",
        lockedAt: now,
        attempt: item.attempt + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(ScheduledEmail.id, item.id),
          eq(ScheduledEmail.status, item.status),
        ),
      )
      .execute();
    if (!claim.meta.changes) continue;

    const payload: EmailPayload = JSON.parse(item.payload);
    const vendorService = new EmailVendorService(env, item.tenantId);
    const vendors = await vendorService.getActiveVendors();

    if (vendors.length === 0) {
      ctx.waitUntil(
        db
          .update(ScheduledEmail)
          .set({ status: "failed", error: "No active vendors", updatedAt: now })
          .where(eq(ScheduledEmail.id, item.id))
          .execute(),
      );
      continue;
    }

    const vendor = vendors[0];
    const adapter = ADAPTERS[vendor.name];

    if (!adapter) {
      ctx.waitUntil(
        db
          .update(ScheduledEmail)
          .set({
            status: "failed",
            error: `Unknown adapter: ${vendor.name}`,
            updatedAt: now,
          })
          .where(eq(ScheduledEmail.id, item.id))
          .execute(),
      );
      continue;
    }

    const send = async () => {
      const sendResult = await withTimeout(
        (signal) =>
          adapter.send({
            endpoint: vendor.apiEndpoint,
            token: vendor.apiToken,
            from: { email: vendor.fromEmail, name: vendor.fromName },
            to: payload.to,
            subject: payload.subject,
            html: payload.content,
            cc: payload.cc,
            bcc: payload.bcc,
            attachments: payload.attachments,
            config: parseConfig(vendor.config),
            signal,
          }),
        VENDOR_TIMEOUT_MS,
      );

      await db
        .update(ScheduledEmail)
        .set({
          status: "sent",
          ...(sendResult.providerMessageId.trim()
            ? { providerMessageId: sendResult.providerMessageId }
            : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ScheduledEmail.id, item.id))
        .execute();
    };

    ctx.waitUntil(
      send().catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(ScheduledEmail)
          .set({
            status: "failed",
            error: message,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(ScheduledEmail.id, item.id))
          .execute();
      }),
    );
  }
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
