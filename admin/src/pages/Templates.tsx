import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <div className="mb-8 flex items-center justify-between">
        <h1>Templates</h1>
        <motion.button
          className="apple-btn apple-btn-primary"
          onClick={() => { setEditingTemplate(null); setFormOpen(true); }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.12 }}
        >
          Add Template
        </motion.button>
      </div>

      {error && (
        <div className="apple-error mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button className="apple-link" style={{ fontSize: 12 }} onClick={fetchTemplates}>Retry</button>
        </div>
      )}

      {!loading && templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first email template with {{key}} placeholders for dynamic content."
          actionLabel="Add Template"
          onAction={() => { setEditingTemplate(null); setFormOpen(true); }}
        />
      ) : (
        <Table
          columns={[
            { key: "slug", header: "Slug", render: (t: Template) => <span className="code" style={{ fontSize: 13 }}>{t.slug}</span> },
            { key: "subject", header: "Subject", render: (t: Template) => <span style={{ color: "var(--text-secondary)" }}>{t.subject}</span> },
            {
              key: "actions", header: "", className: "text-right",
              render: (t: Template) => (
                <div className="flex justify-end gap-1">
                  <button className="apple-link" onClick={() => { setEditingTemplate(t); setFormOpen(true); }}>Edit</button>
                  <button className="apple-link apple-link-danger" onClick={() => setDeleteTarget(t)}>Delete</button>
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
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Template"
        message={`Delete "${deleteTarget?.slug}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleting}
      />
    </motion.div>
  );
}
