import { useState, useEffect } from "react";
import type { Vendor, VendorFormData } from "../types";

interface VendorFormProps {
  open: boolean;
  vendor?: Vendor | null;
  onSave: (data: VendorFormData) => Promise<void>;
  onClose: () => void;
}

const emptyForm: VendorFormData = {
  name: "",
  enabled: true,
  priority: 1,
  apiEndpoint: "",
  apiToken: "",
  fromEmail: "",
  fromName: "",
  config: "",
};

export default function VendorForm({ open, vendor, onSave, onClose }: VendorFormProps) {
  const [form, setForm] = useState<VendorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name,
        enabled: vendor.enabled,
        priority: vendor.priority,
        apiEndpoint: vendor.apiEndpoint,
        apiToken: "",
        fromEmail: vendor.fromEmail,
        fromName: vendor.fromName,
        config: vendor.config || "",
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [vendor, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.apiEndpoint.trim()) { setError("API Endpoint is required"); return; }
    if (!vendor && !form.apiToken.trim()) { setError("API Token is required"); return; }
    if (!form.fromEmail.trim()) { setError("From Email is required"); return; }

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

  const set = (key: keyof VendorFormData, value: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{vendor ? "Edit Vendor" : "Add Vendor"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input className="w-full rounded border px-3 py-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!!vendor} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
              <input type="number" min={1} max={999} className="w-full rounded border px-3 py-2 text-sm" value={form.priority} onChange={(e) => set("priority", parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">API Endpoint</label>
            <input type="url" className="w-full rounded border px-3 py-2 text-sm" value={form.apiEndpoint} onChange={(e) => set("apiEndpoint", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">API Token</label>
            <input type="password" className="w-full rounded border px-3 py-2 text-sm" value={form.apiToken} onChange={(e) => set("apiToken", e.target.value)} placeholder={vendor ? "(leave blank to keep current)" : ""} required={!vendor} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From Email</label>
              <input type="email" className="w-full rounded border px-3 py-2 text-sm" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From Name</label>
              <input className="w-full rounded border px-3 py-2 text-sm" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Enabled
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Config (JSON)</label>
            <textarea className="w-full rounded border px-3 py-2 text-sm font-mono" rows={3} value={form.config} onChange={(e) => set("config", e.target.value)} />
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
