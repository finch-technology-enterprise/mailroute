import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import Table from "../components/Table";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import TemplateForm from "./TemplateForm";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../api/templates";
import type { Template, TemplateFormData } from "../types";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async (data: TemplateFormData) => {
    if (editingTemplate) {
      const updated = await updateTemplate(editingTemplate.id, data);
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? updated.data : t)),
      );
      toast("Template updated", "success");
    } else {
      const created = await createTemplate(data);
      setTemplates((prev) => [...prev, created.data]);
      toast("Template created", "success");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("Template deleted", "success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete template",
      );
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
      <div
        className="mb-6 flex items-center justify-between"
        style={{ flexWrap: "wrap", gap: 12 }}
      >
        <h1>Templates</h1>
        <div className="flex gap-3">
          <input
            className="apple-input"
            style={{
              width: 200,
              fontSize: 14,
              padding: "8px 12px",
              minHeight: 36,
            }}
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={() => {
              setEditingTemplate(null);
              setFormOpen(true);
            }}
            whileTap={{ scale: 0.97 }}
          >
            Add Template
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="apple-error mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="apple-link"
            style={{ fontSize: 12 }}
            onClick={fetchTemplates}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching templates" : "No templates yet"}
          description={
            search
              ? "Try a different search term."
              : "Create your first email template with {{key}} placeholders."
          }
          actionLabel={search ? undefined : "Add Template"}
          onAction={
            search
              ? undefined
              : () => {
                  setEditingTemplate(null);
                  setFormOpen(true);
                }
          }
        />
      ) : (
        <Table
          columns={[
            {
              key: "slug",
              header: "Slug",
              render: (t: Template) => (
                <span className="code" style={{ fontSize: 13 }}>
                  {t.slug}
                </span>
              ),
            },
            {
              key: "subject",
              header: "Subject",
              render: (t: Template) => (
                <span style={{ color: "var(--text-secondary)" }}>
                  {t.subject}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (t: Template) => (
                <div className="flex justify-end gap-1">
                  <button
                    className="apple-link"
                    onClick={() => {
                      setEditingTemplate(t);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="apple-link apple-link-danger"
                    onClick={() => setDeleteTarget(t)}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(t) => t.id}
          isLoading={loading}
        />
      )}

      <TemplateForm
        open={formOpen}
        template={editingTemplate}
        onSave={handleSave}
        onClose={() => {
          setFormOpen(false);
          setEditingTemplate(null);
        }}
      />
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
