import { useState, useEffect } from "react";
import FormModal from "../components/FormModal";
import type { Template, TemplateFormData } from "../types";

interface TemplateFormProps {
  open: boolean;
  template?: Template | null;
  onSave: (data: TemplateFormData) => Promise<void>;
  onClose: () => void;
}

const emptyForm: TemplateFormData = { slug: "", subject: "", content: "" };

export default function TemplateForm({ open, template, onSave, onClose }: TemplateFormProps) {
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (template) {
      setForm({ slug: template.slug, subject: template.subject, content: template.content });
    } else {
      setForm(emptyForm);
    }
    setError("");
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

  return (
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
    </FormModal>
  );
}
