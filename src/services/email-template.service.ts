// src/services/email-template.service.ts
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { EmailTemplate } from "../db/schema"; //
import { CloudflareBindings } from "../lib/cloudflare.binding";

export class EmailTemplateService {
  private db;

  constructor(env: CloudflareBindings) {
    this.db = drizzle(env.D1_DATABASE);
  }

  async getProcessedTemplate(
    slug: string,
    replacements: Record<string, string>,
  ) {
    const template = await this.db
      .select()
      .from(EmailTemplate)
      .where(eq(EmailTemplate.slug, slug))
      .get();

    if (!template) return null;

    let processedSubject = template.subject;
    let processedContent = template.content;

    // Literal substitution via split/join — NOT RegExp/String.replace.
    // Building a regex from a user-supplied `key` is exploitable (a key with
    // regex metacharacters throws a SyntaxError → DoS, or triggers ReDoS), and
    // String.replace interprets `$&`/`$1`/`$$` in the value specially. split/join
    // treats both the token and the value as plain strings, closing both holes.
    Object.entries(replacements).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      processedSubject = processedSubject.split(token).join(value);
      processedContent = processedContent.split(token).join(value);
    });

    return {
      subject: processedSubject,
      content: processedContent,
    };
  }
}
