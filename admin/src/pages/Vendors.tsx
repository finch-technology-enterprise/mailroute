import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import Table from "../components/Table";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import VendorForm from "./VendorForm";
import { listVendors, createVendor, updateVendor, deleteVendor } from "../api/vendors";
import type { Vendor, VendorFormData } from "../types";

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listVendors();
      setVendors(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleToggle = async (vendor: Vendor) => {
    try {
      await updateVendor(vendor.id, { enabled: !vendor.enabled });
      setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, enabled: !v.enabled } : v));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle vendor");
    }
  };

  const handleSave = async (data: VendorFormData) => {
    if (editingVendor) {
      const updated = await updateVendor(editingVendor.id, data);
      setVendors((prev) => prev.map((v) => v.id === editingVendor.id ? updated.data : v));
    } else {
      const created = await createVendor(data);
      setVendors((prev) => [...prev, created.data]);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget.id);
      setVendors((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor");
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
        <h1>Vendors</h1>
        <motion.button
          className="apple-btn apple-btn-primary"
          onClick={() => { setEditingVendor(null); setFormOpen(true); }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.12 }}
        >
          Add Vendor
        </motion.button>
      </div>

      {error && (
        <div className="apple-error mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button className="apple-link" style={{ fontSize: 12 }} onClick={fetchVendors}>Retry</button>
        </div>
      )}

      {!loading && vendors.length === 0 ? (
        <EmptyState
          title="No vendors configured"
          description="Add your first email vendor to start sending emails through the failover chain."
          actionLabel="Add Vendor"
          onAction={() => { setEditingVendor(null); setFormOpen(true); }}
        />
      ) : (
        <Table
          columns={[
            { key: "name", header: "Name", render: (v: Vendor) => <span style={{ fontWeight: 500 }}>{v.name}</span> },
            { key: "enabled", header: "Status", render: (v: Vendor) => <StatusBadge enabled={v.enabled} onToggle={() => handleToggle(v)} /> },
            { key: "priority", header: "Priority", render: (v: Vendor) => <span style={{ color: "var(--text-secondary)" }}>{v.priority}</span> },
            { key: "fromEmail", header: "From", render: (v: Vendor) => <span style={{ color: "var(--text-secondary)" }}>{v.fromEmail}</span> },
            {
              key: "actions", header: "", className: "text-right",
              render: (v: Vendor) => (
                <div className="flex justify-end gap-1">
                  <button className="apple-link" onClick={() => { setEditingVendor(v); setFormOpen(true); }}>Edit</button>
                  <button className="apple-link apple-link-danger" onClick={() => setDeleteTarget(v)}>Delete</button>
                </div>
              ),
            },
          ]}
          data={vendors}
          keyExtractor={(v) => v.id}
          isLoading={loading}
        />
      )}

      <VendorForm open={formOpen} vendor={editingVendor} onSave={handleSave} onClose={() => { setFormOpen(false); setEditingVendor(null); }} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleting}
      />
    </motion.div>
  );
}
