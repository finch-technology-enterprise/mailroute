import { useState, useEffect, useCallback, useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useToast } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import AnimatedPage from "../components/AnimatedPage";
import Skeleton from "../components/Skeleton";
import InlineError from "../components/InlineError";
import { get, post, del, setAuthKey } from "../api/client";
import type { ApiResponse } from "../types";
import Icon from "../components/Icon";
import Modal from "../components/Modal";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [existingKeyValue, setExistingKeyValue] = useState("");
  const { toast } = useToast();
  const shouldReduce = useReducedMotion();
  const createTitleId = useId();
  const createdTitleId = useId();
  const createdDescriptionId = useId();
  const addExistingTitleId = useId();
  const addExistingDescriptionId = useId();
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const addExistingButtonRef = useRef<HTMLButtonElement>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await get<ApiResponse<ApiKeyRow[]>>("/api-keys");
      setKeys(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const openCreate = () => {
    setNewKeyName("");
    setCreatedKey(null);
    setShowCreateForm(true);
  };

  const closeAll = () => {
    setShowCreateForm(false);
    setCreatedKey(null);
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await post<ApiResponse<{ rawKey: string; name: string }>>(
        "/api-keys",
        { name: newKeyName.trim() },
      );
      setCreatedKey(res.data.rawKey);
      setAuthKey(res.data.rawKey);
      toast("API key created", "success");
      fetchKeys();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create API key",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      try {
        await navigator.clipboard.writeText(createdKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast("Failed to copy", "error");
      }
    }
  };

  const openAddExisting = () => {
    setExistingKeyValue("");
    setShowAddExisting(true);
  };

  const handleSaveExisting = () => {
    const trimmed = existingKeyValue.trim();
    if (!trimmed) return;
    setAuthKey(trimmed);
    setShowAddExisting(false);
    setExistingKeyValue("");
    toast("API key saved to browser", "success");
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await del(`/api-keys/${revokeTarget.id}`);
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id
            ? { ...k, revokedAt: new Date().toISOString() }
            : k,
        ),
      );
      setRevokeTarget(null);
      toast("API key revoked", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to revoke API key",
        "error",
      );
    } finally {
      setRevoking(false);
    }
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <AnimatedPage>
      <div
        className="mb-6 flex items-center justify-between"
        style={{ flexWrap: "wrap", gap: 12 }}
      >
        <h1>API Keys</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            ref={addExistingButtonRef}
            className="apple-btn"
            onClick={openAddExisting}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Add Existing Key
          </motion.button>
          <motion.button
            ref={createButtonRef}
            className="apple-btn apple-btn-primary"
            onClick={openCreate}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Create Key
          </motion.button>
        </div>
      </div>

      {error && <InlineError error={error} onRetry={fetchKeys} />}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton count={2} height={46} />
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create an API key to use with the email sending API."
          actionLabel="Create Key"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-8">
            {activeKeys.map((key) => (
              <div
                key={key.id}
                className="card p-4"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="key" size={16} color="#fff" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {key.name}
                    </div>
                    <code
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {key.keyPrefix}
                    </code>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                  <button
                    className="apple-link apple-link-danger"
                    onClick={() => setRevokeTarget(key)}
                    style={{ fontSize: 13 }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>

          {revokedKeys.length > 0 && (
            <>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: "var(--text-secondary)",
                }}
              >
                Revoked
              </h2>
              <div className="flex flex-col gap-2">
                {revokedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="card p-4"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      opacity: 0.5,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "var(--red)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="x" size={16} color="#fff" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {key.name}
                        </div>
                        <code
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          {key.keyPrefix}
                        </code>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Revoked{" "}
                      {key.revokedAt
                        ? new Date(key.revokedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Create dialog */}
      <Modal
        open={showCreateForm && !createdKey}
        onClose={closeAll}
        ariaLabelledBy={createTitleId}
        returnFocusRef={createButtonRef}
        maxWidth={420}
        surfaceClassName="card p-6"
        surfaceStyle={{ width: "90%" }}
      >
        <h2
          id={createTitleId}
          style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}
        >
          Create API Key
        </h2>
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor={`${createTitleId}-name`}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            Key name
          </label>
          <input
            id={`${createTitleId}-name`}
            className="apple-input"
            style={{
              width: "100%",
              fontSize: 14,
              padding: "8px 12px",
              minHeight: 44,
              fontFamily: "var(--font-sans)",
            }}
            placeholder="e.g. Production"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating && newKeyName.trim()) {
                handleCreate();
              }
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <motion.button
            className="apple-btn"
            onClick={closeAll}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Cancel
          </motion.button>
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            {creating ? "Creating…" : "Create"}
          </motion.button>
        </div>
      </Modal>

      <Modal
        open={!!createdKey}
        onClose={closeAll}
        ariaLabelledBy={createdTitleId}
        ariaDescribedBy={createdDescriptionId}
        returnFocusRef={createButtonRef}
        maxWidth={480}
        surfaceClassName="card p-6"
        surfaceStyle={{ width: "90%" }}
      >
        <h2
          id={createdTitleId}
          style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}
        >
          API Key Created
        </h2>
        <p
          id={createdDescriptionId}
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 16,
          }}
        >
          Copy this key now. You won't be able to see it again.
        </p>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 10,
            border: "1px solid var(--border)",
            padding: "12px 14px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            wordBreak: "break-all",
          }}
        >
          <span style={{ flex: 1, color: "var(--text-primary)" }}>
            {createdKey}
          </span>
          <motion.button
            whileTap={{ scale: shouldReduce ? 1 : 0.9 }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: copied ? "var(--green)" : "var(--text-tertiary)",
              width: 44,
              height: 44,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            onClick={handleCopy}
            aria-label={copied ? "API key copied" : "Copy API key"}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
          </motion.button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={closeAll}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Done
          </motion.button>
        </div>
      </Modal>

      <Modal
        open={showAddExisting}
        onClose={() => setShowAddExisting(false)}
        ariaLabelledBy={addExistingTitleId}
        ariaDescribedBy={addExistingDescriptionId}
        returnFocusRef={addExistingButtonRef}
        maxWidth={420}
        surfaceClassName="card p-6"
        surfaceStyle={{ width: "90%" }}
      >
        <h2
          id={addExistingTitleId}
          style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}
        >
          Add Existing Key
        </h2>
        <p
          id={addExistingDescriptionId}
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 16,
          }}
        >
          Paste an API key you previously created to use it in the API Docs
          playground.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor={`${addExistingTitleId}-value`}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            API key
          </label>
          <input
            id={`${addExistingTitleId}-value`}
            className="apple-input"
            style={{
              width: "100%",
              fontSize: 14,
              padding: "8px 12px",
              minHeight: 44,
              fontFamily: "var(--font-mono, monospace)",
            }}
            placeholder="mr_..."
            value={existingKeyValue}
            onChange={(e) => setExistingKeyValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveExisting();
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <motion.button
            className="apple-btn"
            onClick={() => setShowAddExisting(false)}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Cancel
          </motion.button>
          <motion.button
            className="apple-btn apple-btn-primary"
            onClick={handleSaveExisting}
            disabled={!existingKeyValue.trim()}
            whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
          >
            Save
          </motion.button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API Key"
        message={`Revoke "${revokeTarget?.name}"? Applications using this key will immediately lose access.`}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
        isLoading={revoking}
        confirmLabel="Revoke"
      />
    </AnimatedPage>
  );
}
