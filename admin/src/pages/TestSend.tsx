import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import RichEditor from "../components/RichEditor";
import { sendTestEmail } from "../api/admin";
import { listVendors } from "../api/vendors";
import { listTemplates } from "../api/templates";
import type { Vendor, Template, TestSendPayload } from "../types";

function extractPlaceholders(text: string): string[] {
  const set = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(text))) set.add(m[1]);
  return [...set];
}

function replacePlaceholders(text: string, values: Record<string, string>): string {
  let s = text;
  Object.entries(values).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(v);
  });
  return s;
}

const defaultReplacements: Record<string, string> = {
  header: "Notification",
  subheader: "Here are the details.",
  name: "User",
  email: "user@example.com",
  app_name: "MailRoute",
  code: "123456",
  year: "2026",
};

export default function TestSend() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [vendor, setVendor] = useState("auto");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const currentTemplate = useMemo(
    () => templates.find((t) => t.slug === selectedSlug) || null,
    [templates, selectedSlug],
  );

  const placeholders = useMemo(
    () => currentTemplate
      ? extractPlaceholders(currentTemplate.subject + " " + currentTemplate.content)
      : [],
    [currentTemplate],
  );

  useEffect(() => {
    setResult(null);
    setError("");
  }, [to, subject, content]);

  useEffect(() => {
    listVendors().then((res) => setVendors(res.data || [])).catch(() => {});
    listTemplates().then((res) => setTemplates(res.data || [])).catch(() => {});
  }, []);

  const loadTemplate = useCallback((slug: string) => {
    const t = templates.find((tmpl) => tmpl.slug === slug);
    if (!t) return;
    const merged: Record<string, string> = {};
    const keys = extractPlaceholders(t.subject + " " + t.content);
    keys.forEach((k) => {
      merged[k] = defaultReplacements[k] || `{{${k}}}`;
    });
    setReplacements(merged);
    setSubject(replacePlaceholders(t.subject, merged));
    setContent(t.content);
  }, [templates]);

  useEffect(() => {
    if (!selectedSlug) return;
    const t = templates.find((tmpl) => tmpl.slug === selectedSlug);
    if (!t) return;
    setSubject(replacePlaceholders(t.subject, replacements));
    setContent(replacePlaceholders(t.content, replacements));
  }, [replacements, selectedSlug, templates]);

  const handleTemplateSelect = (slug: string) => {
    setSelectedSlug(slug);
    if (slug) loadTemplate(slug);
    else {
      setReplacements({});
    }
  };

  const handleReplacementChange = (key: string, value: string) => {
    setReplacements((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!to.trim()) { setError("Recipient email is required"); return; }
    if (!subject.trim()) { setError("Subject is required"); return; }
    if (!content.trim()) { setError("Content is required"); return; }

    setSending(true);
    try {
      const payload: TestSendPayload = { to, subject, content };
      if (vendor !== "auto") payload.vendor = vendor;
      const res = await sendTestEmail(payload);
      setResult({ success: res.success, message: res.message || "Email sent" });
      toast("Test email sent", "success");
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to send",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <h1 className="mb-8">Test Send</h1>

      <div className="card p-8" style={{ width: "100%", maxWidth: 600 }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="apple-label">To</label>
            <input
              type="email"
              className="apple-input"
              placeholder="you@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="apple-label">Template</label>
            <select
              className="apple-input"
              value={selectedSlug}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              style={{ fontSize: 14, appearance: "auto", cursor: "pointer" }}
            >
              <option value="">No template (write your own)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.slug}>{t.slug}</option>
              ))}
            </select>
          </div>

          {placeholders.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: "14px 16px",
                background: "var(--bg-secondary)",
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-secondary)", width: "100%", marginBottom: 2 }}>
                Template placeholders
              </span>
              {placeholders.map((key) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{`{{${key}}}`}</code>
                  <input
                    className="apple-input code"
                    value={replacements[key] || ""}
                    onChange={(e) => handleReplacementChange(key, e.target.value)}
                    style={{ width: 140, fontSize: 12, padding: "4px 8px", minHeight: 28 }}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="apple-label">Subject</label>
            <input
              className="apple-input"
              placeholder={currentTemplate ? "Subject from template" : "Test email"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="apple-label">Vendor</label>
            <select
              className="apple-input"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              style={{ fontSize: 14, appearance: "auto", cursor: "pointer" }}
            >
              <option value="auto">Auto (priority-based failover)</option>
              {vendors.filter((v) => v.enabled).map((v) => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="apple-label">Content (HTML)</label>
            <RichEditor
              content={content}
              onChange={setContent}
              minHeight={280}
            />
          </div>

          {error && <div className="apple-error">{error}</div>}

          <motion.button
            type="submit"
            className="apple-btn apple-btn-primary"
            disabled={sending}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", bounce: 0, duration: 0.12 }}
          >
            {sending ? "Sending..." : "Send Test Email"}
          </motion.button>
        </form>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className={result.success ? "apple-success mt-6" : "apple-error mt-6"}
          >
            <p style={{ fontWeight: 600, marginBottom: 2 }}>
              {result.success ? "Sent successfully" : "Send failed"}
            </p>
            <p style={{ opacity: 0.8 }}>{result.message}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
