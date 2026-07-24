import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useToast } from "../components/Toast";
import Table from "../components/Table";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import VendorForm from "./VendorForm";
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../api/vendors";
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
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [priorityVal, setPriorityVal] = useState("");
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

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filtered = vendors.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.fromEmail.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = async (vendor: Vendor) => {
    try {
      await updateVendor(vendor.id, { enabled: !vendor.enabled });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, enabled: !v.enabled } : v,
        ),
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle", "error");
    }
  };

  const handleSave = async (data: VendorFormData) => {
    if (editingVendor) {
      const updated = await updateVendor(editingVendor.id, data);
      setVendors((prev) =>
        prev.map((v) => (v.id === editingVendor.id ? updated.data : v)),
      );
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

  const handlePrioritySave = async (vendor: Vendor) => {
    const p = parseInt(priorityVal);
    if (isNaN(p) || p < 1 || p > 999) return;
    try {
      const updated = await updateVendor(vendor.id, { priority: p });
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? updated.data : v)),
      );
      setEditingPriority(null);
      toast("Priority updated", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update priority",
        "error",
      );
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
        <h1>Vendors</h1>
        <div className="flex gap-3">
          <input
            className="apple-input"
            style={{
              width: 200,
              fontSize: 14,
              padding: "8px 12px",
              minHeight: 36,
            }}
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={() => {
              setEditingVendor(null);
              setFormOpen(true);
            }}
            whileTap={{ scale: 0.97 }}
          >
            Add Vendor
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="apple-error mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="apple-link"
            style={{ fontSize: 12 }}
            onClick={fetchVendors}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching vendors" : "No vendors configured"}
          description={
            search
              ? "Try a different search term."
              : "Add your first email vendor to start sending."
          }
          actionLabel={search ? undefined : "Add Vendor"}
          onAction={
            search
              ? undefined
              : () => {
                  setEditingVendor(null);
                  setFormOpen(true);
                }
          }
        />
      ) : (
        <Table
          columns={[
            {
              key: "name",
              header: "Name",
              render: (v: Vendor) => (
                <span style={{ fontWeight: 500 }}>{v.name}</span>
              ),
            },
            {
              key: "enabled",
              header: "Status",
              render: (v: Vendor) => (
                <StatusBadge
                  enabled={v.enabled}
                  onToggle={() => handleToggle(v)}
                />
              ),
            },
            {
              key: "priority",
              header: "Priority",
              render: (v: Vendor) =>
                editingPriority === v.id ? (
                  <div className="flex gap-1" style={{ alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      className="apple-input"
                      style={{
                        width: 64,
                        fontSize: 13,
                        padding: "4px 8px",
                        minHeight: 28,
                      }}
                      value={priorityVal}
                      onChange={(e) => setPriorityVal(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handlePrioritySave(v)
                      }
                      autoFocus
                    />
                    <button
                      className="apple-link"
                      onClick={() => handlePrioritySave(v)}
                      style={{ fontSize: 11 }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    className="apple-link"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                    }}
                    onClick={() => {
                      setEditingPriority(v.id);
                      setPriorityVal(String(v.priority));
                    }}
                  >
                    {v.priority}
                  </button>
                ),
            },
            {
              key: "fromEmail",
              header: "From",
              render: (v: Vendor) => (
                <span style={{ color: "var(--text-secondary)" }}>
                  {v.fromEmail}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (v: Vendor) => (
                <div className="flex justify-end gap-1">
                  <button
                    className="apple-link"
                    onClick={() => {
                      setEditingVendor(v);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="apple-link apple-link-danger"
                    onClick={() => setDeleteTarget(v)}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(v) => v.id}
          isLoading={loading}
        />
      )}

      <VendorForm
        open={formOpen}
        vendor={editingVendor}
        onSave={handleSave}
        onClose={() => {
          setFormOpen(false);
          setEditingVendor(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Vendor"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleting}
      />
    </motion.div>
  );
}
