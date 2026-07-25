import { useState, useEffect } from "react";
import { motion } from "motion/react";
import FormModal from "../components/FormModal";
import Modal from "../components/Modal";
import type { Template, TemplateFormData } from "../types";

interface TemplateFormProps {
  open: boolean;
  template?: Template | null;
  onSave: (data: TemplateFormData) => Promise<void>;
  onClose: () => void;
}

const emptyForm: TemplateFormData = { slug: "", subject: "", content: "" };

function replacePlaceholders(text: string, values: Record<string, string>): string {
  let result = text;
  Object.entries(values).forEach(([key, value]) => {
    result = result.split(`{{${key}}}`).join(value);
  });
  return result;
}

export default function TemplateForm({ open, template, onSave, onClose }: TemplateFormProps) {
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setForm({ slug: template.slug, subject: template.subject, content: template.content });
    } else {
      setForm(emptyForm);
    }
    setError("");
    setShowPreview(false);
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^[a-z0-9-]+$/.test(form.slug)) { setError("Slug must be lowercase alphanumeric with hyphens only"); return; }
    if (!form.subject.trim()) { setError("Subject is required"); return; }
    if (!form.content.trim()) { setError("Content is required"); return; }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof TemplateFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openPreview = () => {
    const matches = new Set<string>();
    const text = form.subject + " " + form.content;
    const re = /\{\{([^}]+)\}\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.add(m[1]);
    }
    const samples: Record<string, string> = {};
    matches.forEach((key) => {
      samples[key] = `[${key}]`;
    });
    setSampleValues(samples);
    setShowPreview(true);
  };

  const previewSubject = replacePlaceholders(form.subject, sampleValues);
  const previewContent = replacePlaceholders(form.content, sampleValues);

  return (
    <>
      <FormModal open={open} onClose={onClose} onSubmit={handleSubmit} title={template ? "Edit Template" : "Add Template"} saving={saving} error={error} maxWidth={600}>
        <div>
          <label className="apple-label">Slug</label>
          <input className="apple-input code" value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={!!template} required placeholder="e.g., welcome-email" />
          <p className="apple-hint">Lowercase letters, numbers, and hyphens only.</p>
        </div>
        <div>
          <label className="apple-label">Subject</label>
          <input className="apple-input" value={form.subject} onChange={(e) => set("subject", e.target.value)} required placeholder="Welcome to {{app_name}}!" />
          <p className="apple-hint">Use <code>{"{{key}}"}</code> for placeholders.</p>
        </div>
        <div>
          <label className="apple-label">Content (HTML)</label>
          <textarea className="apple-input code" rows={12} value={form.content} onChange={(e) => set("content", e.target.value)} required placeholder="<h1>Welcome, {{name}}!</h1>" />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <motion.button
            type="button"
            className="apple-btn"
            onClick={openPreview}
            whileTap={{ scale: 0.97 }}
          >
            Preview
          </motion.button>
        </div>
      </FormModal>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Template Preview" maxWidth={600}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
          <strong>Subject:</strong> {previewSubject}
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            fontSize: 14,
            color: "var(--text-primary)",
            maxHeight: 400,
            overflow: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
          Placeholders are shown as <code>[key]</code>. Customize sample values in a future update.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <motion.button className="apple-btn" onClick={() => setShowPreview(false)} whileTap={{ scale: 0.97 }}>Close</motion.button>
        </div>
      </Modal>
    </>
  );
}
