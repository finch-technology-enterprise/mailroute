import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
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
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const { toast } = useToast();

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

  const filtered = vendors.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.fromEmail.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = async (vendor: Vendor) => {
    try {
      await updateVendor(vendor.id, { enabled: !vendor.enabled });
      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, enabled: !v.enabled } : v)));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle", "error");
    }
  };

  const handleSave = async (data: VendorFormData) => {
    if (editingVendor) {
      const updated = await updateVendor(editingVendor.id, data);
      setVendors((prev) => prev.map((v) => (v.id === editingVendor.id ? updated.data : v)));
      toast("Vendor updated", "success");
    } else {
      const created = await createVendor(data);
      setVendors((prev) => [...prev, created.data]);
      toast("Vendor created", "success");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget.id);
      setVendors((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("Vendor deleted", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor");
    } finally {
      setDeleting(false);
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDrop = async () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    dragItem.current = null;
    dragOverItem.current = null;
    if (from === null || to === null || from === to) return;

    const reordered = [...filtered];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const updated = reordered.map((v, i) => ({ ...v, priority: i + 1 }));
    setVendors((prev) => prev.map((v) => updated.find((u) => u.id === v.id) || v));

    try {
      await Promise.all(updated.map((v) => updateVendor(v.id, { priority: v.priority })));
      toast("Priority updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save priority", "error");
      fetchVendors();
    }
  };

  const dragColumns = [
    {
      key: "drag",
      header: "",
      render: () => (
        <span style={{ color: "var(--text-tertiary)", cursor: "grab", fontSize: 16, userSelect: "none", lineHeight: 1 }}>
          ⋮⋮
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (v: Vendor) => <span style={{ fontWeight: 500 }}>{v.name}</span>,
    },
    {
      key: "enabled",
      header: "Status",
      render: (v: Vendor) => <StatusBadge enabled={v.enabled} onToggle={() => handleToggle(v)} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (v: Vendor) => (
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{v.priority}</span>
      ),
    },
    {
      key: "fromEmail",
      header: "From",
      render: (v: Vendor) => (
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{v.fromName}</span>
          {v.fromName ? " <" : ""}{v.fromEmail}{v.fromName ? ">" : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (v: Vendor) => (
        <div className="flex justify-end gap-1">
          <button className="apple-link" onClick={() => { setEditingVendor(v); setFormOpen(true); }}>Edit</button>
          <button className="apple-link apple-link-danger" onClick={() => setDeleteTarget(v)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}>
      <div className="mb-6 flex items-center justify-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <h1>Vendors</h1>
        <div className="flex gap-3">
          <input
            className="apple-input"
            style={{ width: 200, fontSize: 14, padding: "8px 12px", minHeight: 36 }}
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={() => { setEditingVendor(null); setFormOpen(true); }}
            whileTap={{ scale: 0.97 }}
          >
            Add Vendor
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="apple-error mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button className="apple-link" style={{ fontSize: 12 }} onClick={fetchVendors}>Retry</button>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching vendors" : "No vendors configured"}
          description={search ? "Try a different search term." : "Add your first email vendor to start sending."}
          actionLabel={search ? undefined : "Add Vendor"}
          onAction={search ? undefined : () => { setEditingVendor(null); setFormOpen(true); }}
        />
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: 20, height: 14 }} />
              <div className="skeleton-shimmer" style={{ width: "20%", height: 14 }} />
              <div className="skeleton-shimmer" style={{ width: "15%", height: 14 }} />
              <div className="skeleton-shimmer" style={{ width: "10%", height: 14 }} />
              <div className="skeleton-shimmer" style={{ width: "25%", height: 14 }} />
            </div>
          ))}
        </div>
      ) : (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <Table
            columns={dragColumns}
            data={filtered}
            keyExtractor={(v) => v.id}
            isLoading={false}
            rowProps={(v, i) => ({
              draggable: true,
              onDragStart: () => handleDragStart(i),
              onDragOver: () => handleDragOver(i),
              onDragEnd: handleDrop,
              style: {
                cursor: "grab",
                opacity: dragItem.current === i ? 0.5 : 1,
                borderTop: dragOverItem.current === i && dragItem.current !== i ? "2px solid var(--accent)" : undefined,
              },
            })}
          />
        </div>
      )}

      <VendorForm open={formOpen} vendor={editingVendor} onSave={handleSave} onClose={() => { setFormOpen(false); setEditingVendor(null); }} />
      <ConfirmDialog open={!!deleteTarget} title="Delete Vendor" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isLoading={deleting} />
    </motion.div>
  );
}
