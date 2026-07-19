import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { EmailTemplateService } from "../services/email-template.service";
import { EmailService, EmailPayload } from "../services/email.service";
import { ApiAuthKeyMiddleware } from "../middlewares/api-auth-key.middleware";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { LogToNewRelic } from "../utils/helpers.util";

const general = new Hono<{ Bindings: CloudflareBindings }>();

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

// Send in the background but capture failures — otherwise a non-OK response
// from Sender.net throws into a floating promise and the failure is invisible.
const sendInBackground = (
  c: Parameters<EmailService["sendEmail"]>[0],
  emailService: EmailService,
  payload: EmailPayload,
) => {
  c.executionCtx.waitUntil(
    emailService.sendEmail(c, payload).catch((error: unknown) => {
      LogToNewRelic(c, "sendEmail failed", {
        level: "ERROR",
        "context.to": payload.to,
        "context.error": error instanceof Error ? error.message : String(error),
      });
    }),
  );
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

const sendOtpSchema = z.object({
  to: emailField,
  // OTP codes are short and alphanumeric — reject anything else outright.
  otp: z.coerce.string().regex(/^[a-zA-Z0-9]{1,12}$/, "Invalid OTP"),
});

const sendEmailSchema = z.object({
  to: emailField,
  subject: subjectField,
  content: contentField,
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
  return c.body(null, 200);
});

general.post(
  "/send-otp",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendOtpSchema),
  async (c) => {
    const { to, otp } = c.req.valid("json");

    const emailTemplateService = new EmailTemplateService(c.env);
    const emailData = await emailTemplateService.getProcessedTemplate(
      "otp-verification",
      { code: otp },
    );

    if (!emailData) {
      return c.json(ApiResponse(false, "Template not found"), 404);
    }

    const emailService = new EmailService(c.env);
    sendInBackground(c, emailService, {
      to,
      subject: emailData.subject,
      content: emailData.content,
    });

    return c.json(ApiResponse(true, "Email is being sent"), 200);
  },
);

general.post(
  "/send-email",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendEmailSchema),
  async (c) => {
    const { to, subject, content } = c.req.valid("json");

    const emailService = new EmailService(c.env);
    sendInBackground(c, emailService, { to, subject, content });

    return c.json(ApiResponse(true, "Email is being sent"), 200);
  },
);

general.post(
  "/send-template",
  RateLimitMiddleware,
  ApiAuthKeyMiddleware,
  jsonBody(sendTemplateSchema),
  async (c) => {
    const { to, template, subject, replacements } = c.req.valid("json");

    const emailTemplateService = new EmailTemplateService(c.env);
    const emailData = await emailTemplateService.getProcessedTemplate(
      template,
      replacements,
    );

    if (!emailData) {
      return c.json(ApiResponse(false, "Template not found"), 404);
    }

    const emailService = new EmailService(c.env);
    sendInBackground(c, emailService, {
      to,
      subject: subject ?? emailData.subject,
      content: emailData.content,
    });

    return c.json(ApiResponse(true, "Email is being sent"), 200);
  },
);

export default general;
