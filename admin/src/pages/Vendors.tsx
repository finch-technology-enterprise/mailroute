import { useState, useEffect, useCallback } from "react";
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

  const openEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormOpen(true);
  };

  const openAdd = () => {
    setEditingVendor(null);
    setFormOpen(true);
  };

  if (error && vendors.length === 0) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button className="ml-2 underline" onClick={fetchVendors}>Retry</button></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={openAdd}>Add Vendor</button>
      </div>

      {!loading && vendors.length === 0 ? (
        <EmptyState title="No vendors configured" description="Add your first email vendor to start sending emails through the failover chain." actionLabel="Add Vendor" onAction={openAdd} />
      ) : (
        <Table
          columns={[
            { key: "name", header: "Name", render: (v: Vendor) => <span className="font-medium">{v.name}</span> },
            { key: "enabled", header: "Status", render: (v: Vendor) => <StatusBadge enabled={v.enabled} onToggle={() => handleToggle(v)} /> },
            { key: "priority", header: "Priority", render: (v: Vendor) => v.priority },
            { key: "fromEmail", header: "From", render: (v: Vendor) => <span className="text-gray-500">{v.fromEmail}</span> },
            {
              key: "actions", header: "", className: "text-right",
              render: (v: Vendor) => (
                <div className="flex justify-end gap-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800" onClick={() => openEdit(v)}>Edit</button>
                  <button className="text-sm text-red-600 hover:text-red-800" onClick={() => setDeleteTarget(v)}>Delete</button>
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
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleting}
      />
    </div>
  );
}
