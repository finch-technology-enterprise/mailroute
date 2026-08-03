import { drizzle } from "drizzle-orm/d1";
import { eq, and, lte } from "drizzle-orm";
import { ScheduledEmail } from "./db/schema";
import { EmailVendorService } from "./services/email-vendor.service";
import { ADAPTERS } from "./vendors";
import type { CloudflareBindings } from "./lib/cloudflare.binding";
import type { EmailPayload } from "./services/email.service";

export async function scheduled(
  _event: ScheduledEvent,
  env: CloudflareBindings,
  ctx: ExecutionContext,
): Promise<void> {
  const db = drizzle(env.D1_DATABASE);
  const now = new Date().toISOString();

  const items = await db
    .select()
    .from(ScheduledEmail)
    .where(
      and(
        eq(ScheduledEmail.status, "pending"),
        lte(ScheduledEmail.sendAt, now),
      ),
    )
    .all();

  for (const item of items) {
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
      const sendResult = await adapter.send({
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
      });

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
