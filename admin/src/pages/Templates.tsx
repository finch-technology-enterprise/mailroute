import { useState, useEffect, useCallback } from "react";
import Table from "../components/Table";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import TemplateForm from "./TemplateForm";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from "../api/templates";
import type { Template, TemplateFormData } from "../types";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async (data: TemplateFormData) => {
    if (editingTemplate) {
      const updated = await updateTemplate(editingTemplate.id, data);
      setTemplates((prev) => prev.map((t) => t.id === editingTemplate.id ? updated.data : t));
    } else {
      const created = await createTemplate(data);
      setTemplates((prev) => [...prev, created.data]);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  if (error && templates.length === 0) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button className="ml-2 underline" onClick={fetchTemplates}>Retry</button></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { setEditingTemplate(null); setFormOpen(true); }}>Add Template</button>
      </div>

      {!loading && templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create your first email template with {{key}} placeholders for dynamic content." actionLabel="Add Template" onAction={() => { setEditingTemplate(null); setFormOpen(true); }} />
      ) : (
        <Table
          columns={[
            { key: "slug", header: "Slug", render: (t: Template) => <span className="font-mono text-sm font-medium">{t.slug}</span> },
            { key: "subject", header: "Subject", render: (t: Template) => <span className="text-gray-600">{t.subject}</span> },
            {
              key: "actions", header: "", className: "text-right",
              render: (t: Template) => (
                <div className="flex justify-end gap-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800" onClick={() => { setEditingTemplate(t); setFormOpen(true); }}>Edit</button>
                  <button className="text-sm text-red-600 hover:text-red-800" onClick={() => setDeleteTarget(t)}>Delete</button>
                </div>
              ),
            },
          ]}
          data={templates}
          keyExtractor={(t) => t.id}
          isLoading={loading}
        />
      )}

      <TemplateForm open={formOpen} template={editingTemplate} onSave={handleSave} onClose={() => { setFormOpen(false); setEditingTemplate(null); }} />
      <ConfirmDialog open={!!deleteTarget} title="Delete Template" message={`Delete "${deleteTarget?.slug}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />
    </div>
  );
}
