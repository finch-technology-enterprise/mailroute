import { useState, useEffect } from "react";
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{template ? "Edit Template" : "Add Template"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Slug</label>
            <input className="w-full rounded border px-3 py-2 text-sm font-mono" value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={!!template} required placeholder="e.g., welcome-email" />
            <p className="mt-1 text-xs text-gray-400">Lowercase letters, numbers, and hyphens only.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.subject} onChange={(e) => set("subject", e.target.value)} required placeholder="Welcome to {{app_name}}!" />
            <p className="mt-1 text-xs text-gray-400">Use <code className="rounded bg-gray-100 px-1">{'{{key}}'}</code> for placeholders.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Content (HTML)</label>
            <textarea className="w-full rounded border px-3 py-2 text-sm font-mono" rows={12} value={form.content} onChange={(e) => set("content", e.target.value)} required placeholder="<h1>Welcome, {{name}}!</h1>" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
