import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { ApiResponse } from "../utils/response.util";
import { EmailTemplateService } from "../services/email-template.service";
import { EmailService, EmailPayload } from "../services/email.service";
import { ApiAuthKeyMiddleware } from "../middlewares/api-auth-key.middleware";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { LogToNewRelic } from "../utils/helpers.util";
import { ScheduledEmail } from "../db/schema";
import type { AppEnv } from "../lib/app-env";

const general = new Hono<AppEnv>();

// Shared validator that keeps the project's ApiResponse envelope on failure.
const jsonBody = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        ApiResponse(false, "Invalid request body", result.error.issues),
        400,
      );
    }
  });

const sendInBackground = (
  c: Parameters<EmailService["sendEmail"]>[0],
  emailService: EmailService,
  payload: EmailPayload,
  sendId: string,
) => {
  c.executionCtx.waitUntil(
    emailService.sendEmail(c, payload, undefined, sendId).catch((error: unknown) => {
      LogToNewRelic(c, "sendEmail failed", {
        level: "ERROR",
        "context.send_id": sendId,
        "context.to": payload.to,
        "context.error": error instanceof Error ? error.message : String(error),
      });
    }),
  );
};

const scheduleOrSend = async (
  c: Parameters<EmailService["sendEmail"]>[0],
  emailService: EmailService,
  payload: EmailPayload,
  sendId: string,
  sendAt?: string,
) => {
  if (sendAt) {
    const db = drizzle(c.env.D1_DATABASE);
    await db.insert(ScheduledEmail).values({
      id: sendId,
      tenantId: c.get("tenantId"),
      payload: JSON.stringify(payload),
      sendAt,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).execute();
  } else {
    sendInBackground(c, emailService, payload, sendId);
  }
};

// --- Shared, hardened field definitions -------------------------------------
// All inputs are bounded and charset-constrained. The body is already capped at
// 50KB globally (bodyLimit), but per-field limits give precise, early rejection.

// RFC 5321 caps an address at 254 chars; z.email() rejects embedded CR/LF.
const emailField = z.email().max(254);

// Subject: bounded, and CR/LF stripped as defense-in-depth against header
// injection (vendors send via JSON APIs today, but a subject must never carry
// newlines). Collapses to spaces, then trims.
const subjectField = z
  .string()
  .min(1)
  .max(255)
  .transform((s) => s.replace(/[\r\n]+/g, " ").trim())
  .refine((s) => s.length > 0, "Subject cannot be blank");

// HTML body: bounded to the body limit; sent verbatim as HTML by design.
const contentField = z.string().min(1).max(50_000);

const attachmentSchema = z.object({
  filename: z.string().min(1).max(256),
  content: z.string().min(1),
  contentType: z.string().max(128).optional(),
});

const sendOtpSchema = z.object({
  to: emailField,
  // OTP codes are short and alphanumeric — reject anything else outright.
  otp: z.coerce.string().regex(/^[a-zA-Z0-9]{1,12}$/, "Invalid OTP"),
});

const sendEmailSchema = z.object({
  to: emailField,
  subject: subjectField,
  content: contentField,
  cc: emailField.optional(),
  bcc: emailField.optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  track: z.coerce.boolean().optional().default(false),
  sendAt: z.string().datetime().optional(),
});

const sendBatchSchema = z.object({
  emails: z
    .array(
      z.object({
        to: emailField,
        subject: subjectField,
        content: contentField,
        cc: emailField.optional(),
        bcc: emailField.optional(),
        attachments: z.array(attachmentSchema).max(10).optional(),
        track: z.coerce.boolean().optional().default(false),
        sendAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(50),
});

const sendTemplateSchema = z.object({
  to: emailField,
  // Template slug: lowercase alphanumeric + hyphens only. Bounds the D1 lookup
  // and rejects junk before it ever touches the database.
  template: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/, "Invalid template slug"),
  // Optional subject override. When omitted, the template's own (placeholder-
  // substituted) subject is used.
  subject: subjectField.optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  track: z.coerce.boolean().optional().default(false),
  sendAt: z.string().datetime().optional(),
  // Placeholder map. Keys are constrained to a safe charset so they can never
  // inject regex/markup into substitution; values are coerced to strings and
  // bounded; the map size is capped to prevent abuse.
  replacements: z
    .record(
      z.string().regex(/^[a-zA-Z0-9_]{1,64}$/, "Invalid replacement key"),
      z.coerce.string().max(50_000),
    )
    .refine(
      (r) => Object.keys(r).length <= 50,
      "Too many replacement keys (max 50)",
    )
    .default({}),
});

general.get("/health", async (c) => {
  let dbOk = false;
  try {
    await c.env.D1_DATABASE.prepare("SELECT 1").all();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return c.json({
    status: dbOk ? "healthy" : "degraded",
    database: dbOk ? "connected" : "unreachable",
    version: "1.0.0",
    environment: c.env.APP_ENVIRONMENT || "unknown",
    timestamp: new Date().toISOString(),
  }, dbOk ? 200 : 503);
});

general.post(
  "/send-otp",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendOtpSchema),
  async (c) => {
    const { to, otp } = c.req.valid("json");

    const tenantId = c.get("tenantId");
    const emailTemplateService = new EmailTemplateService(c.env, tenantId);
    const emailData = await emailTemplateService.getProcessedTemplate(
      "otp-verification",
      { code: otp },
    );

    if (!emailData) {
      return c.json(ApiResponse(false, "Template not found"), 404);
    }

    const emailService = new EmailService(c.env, tenantId);
    const sendId = crypto.randomUUID();
    sendInBackground(c, emailService, {
      to,
      subject: emailData.subject,
      content: emailData.content,
    }, sendId);

    return c.json(ApiResponse(true, "Email is being sent", { sendId }), 200);
  },
);

general.post(
  "/send-email",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendEmailSchema),
  async (c) => {
    const { to, subject, content, cc, bcc, track, sendAt } = c.req.valid("json");

    const tenantId = c.get("tenantId");
    const emailService = new EmailService(c.env, tenantId);
    const sendId = crypto.randomUUID();
    await scheduleOrSend(c, emailService, { to, subject, content, cc, bcc, track }, sendId, sendAt);

    return c.json(sendAt
      ? ApiResponse(true, "Email scheduled", { sendId, sendAt })
      : ApiResponse(true, "Email is being sent", { sendId }), 200);
  },
);

general.post(
  "/send-batch",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendBatchSchema),
  async (c) => {
    const { emails } = c.req.valid("json");

    const tenantId = c.get("tenantId");
    const emailService = new EmailService(c.env, tenantId);

    const CHUNK_SIZE = 10;
    const allSendIds: string[] = [];
    let hasScheduled = false;
    for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
      const chunk = emails.slice(i, i + CHUNK_SIZE);
      const ids = chunk.map(() => crypto.randomUUID());
      allSendIds.push(...ids);
      await Promise.allSettled(chunk.map((email, j) => {
        if (email.sendAt) hasScheduled = true;
        return scheduleOrSend(c, emailService, email, ids[j], email.sendAt);
      }));
    }

    return c.json(ApiResponse(true, hasScheduled ? "Emails scheduled" : "Emails are being sent", { sendIds: allSendIds }), 200);
  },
);

general.post(
  "/send-template",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendTemplateSchema),
  async (c) => {
    const { to, template, subject, replacements, attachments, track, sendAt } = c.req.valid("json");

    const tenantId = c.get("tenantId");
    const emailTemplateService = new EmailTemplateService(c.env, tenantId);
    const emailData = await emailTemplateService.getProcessedTemplate(
      template,
      replacements,
    );

    if (!emailData) {
      return c.json(ApiResponse(false, "Template not found"), 404);
    }

    const emailService = new EmailService(c.env, tenantId);
    const sendId = crypto.randomUUID();
    await scheduleOrSend(c, emailService, {
      to,
      subject: subject ?? emailData.subject,
      content: emailData.content,
      attachments,
      track,
    }, sendId, sendAt);

    return c.json(sendAt
      ? ApiResponse(true, "Email scheduled", { sendId, sendAt })
      : ApiResponse(true, "Email is being sent", { sendId }), 200);
  },
);

export default general;
