import { useState, useEffect } from "react";
import FormModal from "../components/FormModal";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.apiEndpoint.trim()) { setError("API Endpoint is required"); return; }
    if (!vendor && !form.apiToken.trim()) { setError("API Token is required"); return; }
    if (!form.fromEmail.trim()) { setError("From Email is required"); return; }

    if (vendor && !form.apiToken.trim()) {
      const { apiToken, ...rest } = form;
      await onSave(rest as VendorFormData);
      onClose();
      return;
    }

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
    <FormModal open={open} onClose={onClose} onSubmit={handleSubmit} title={vendor ? "Edit Vendor" : "Add Vendor"} saving={saving} error={error}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="apple-label">Name</label>
          <input className="apple-input" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!!vendor} required />
        </div>
        <div>
          <label className="apple-label">Priority</label>
          <input type="number" min={1} max={999} className="apple-input" value={form.priority} onChange={(e) => set("priority", parseInt(e.target.value) || 1)} />
        </div>
      </div>
      <div>
        <label className="apple-label">API Endpoint</label>
        <input type="url" className="apple-input" value={form.apiEndpoint} onChange={(e) => set("apiEndpoint", e.target.value)} required />
      </div>
      <div>
        <label className="apple-label">API Token</label>
        <input type="password" className="apple-input" value={form.apiToken} onChange={(e) => set("apiToken", e.target.value)} placeholder={vendor ? "Leave blank to keep current" : ""} required={!vendor} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="apple-label">From Email</label>
          <input type="email" className="apple-input" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} required />
        </div>
        <div>
          <label className="apple-label">From Name</label>
          <input className="apple-input" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-3" style={{ fontSize: 14, color: "var(--text-primary)", cursor: "pointer" }}>
        <input type="checkbox" className="apple-checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        Enabled
      </label>
      <div>
        <label className="apple-label">Config (JSON)</label>
        <textarea className="apple-input code" rows={3} value={form.config} onChange={(e) => set("config", e.target.value)} style={{ fontSize: 13 }} />
      </div>
    </FormModal>
  );
}
