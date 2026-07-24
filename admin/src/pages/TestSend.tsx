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

const sectionStyle: React.CSSProperties = {
  marginBottom: 28,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  marginBottom: 10,
  paddingLeft: 2,
};

const fieldGroupStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  overflow: "hidden",
};

const fieldRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
  padding: "12px 14px 0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: "0 14px 12px",
  fontSize: 15,
  fontFamily: "var(--font-sans)",
  color: "var(--text-primary)",
  outline: "none",
  minHeight: 22,
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--border)",
  margin: "0 14px",
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
    else setReplacements({});
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
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ ...sectionStyle, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Test Send</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            Send a test email to verify delivery
          </p>
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 14,
              lineHeight: 1.4,
              ...(result.success
                ? { background: "rgba(52, 199, 89, 0.12)", color: "#1d7a3a" }
                : { background: "rgba(255, 69, 58, 0.1)", color: "#c0392b" }),
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 1 }}>
              {result.success ? "Sent" : "Failed"}
            </div>
            <div style={{ opacity: 0.8 }}>{result.message}</div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Recipient</div>
            <div style={fieldGroupStyle}>
              <div style={fieldRowStyle}>
                <label style={fieldLabelStyle}>To</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Content</div>
            <div style={fieldGroupStyle}>
              <div style={fieldRowStyle}>
                <label style={fieldLabelStyle}>Template</label>
                <select
                  value={selectedSlug}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "auto",
                    cursor: "pointer",
                    paddingBottom: 12,
                  }}
                >
                  <option value="">Custom (write your own)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.slug}>{t.slug}</option>
                  ))}
                </select>
              </div>

              {placeholders.length > 0 && (
                <>
                  {placeholders.map((key, i) => (
                    <div key={key}>
                      {i === 0 && <div style={separatorStyle} />}
                      <div style={fieldRowStyle}>
                        <label style={{ ...fieldLabelStyle, paddingTop: 10 }}>{`{{${key}}}`}</label>
                        <input
                          value={replacements[key] || ""}
                          onChange={(e) => handleReplacementChange(key, e.target.value)}
                          placeholder={`Value for ${key}`}
                          style={{ ...inputStyle, paddingBottom: 10, fontSize: 14 }}
                          className="code"
                        />
                      </div>
                      {i < placeholders.length - 1 && <div style={separatorStyle} />}
                    </div>
                  ))}
                </>
              )}

              <div style={separatorStyle} />

              <div style={fieldRowStyle}>
                <label style={fieldLabelStyle}>Subject</label>
                <input
                  placeholder={currentTemplate ? "Subject from template" : "Test email"}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Advanced</div>
            <div style={fieldGroupStyle}>
              <div style={fieldRowStyle}>
                <label style={fieldLabelStyle}>Vendor</label>
                <select
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "auto",
                    cursor: "pointer",
                    paddingBottom: 12,
                  }}
                >
                  <option value="auto">Auto (priority-based failover)</option>
                  {vendors.filter((v) => v.enabled).map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {currentTemplate ? (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Preview</div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <iframe
                  srcDoc={content}
                  title="Template preview"
                  sandbox=""
                  style={{
                    width: "100%",
                    height: 400,
                    border: "none",
                    display: "block",
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Message Body</div>
              <RichEditor
                content={content}
                onChange={setContent}
                minHeight={220}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255, 69, 58, 0.1)",
                color: "#c0392b",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={sending}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", bounce: 0, duration: 0.12 }}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: sending ? "var(--accent-dimmed, #0071e366)" : "var(--accent)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: sending ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              marginBottom: 40,
            }}
          >
            {sending ? "Sending…" : "Send Test Email"}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
}
