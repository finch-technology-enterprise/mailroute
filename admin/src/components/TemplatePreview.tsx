import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Template } from "../types";
import Modal from "./Modal";

const sampleReplacements: Record<string, string> = {
  header: "Your Account Has Been Updated",
  subheader: "Here's what changed in your account settings.",
  name: "John Doe",
  email: "john@example.com",
  app_name: "MailRoute",
  code: "482931",
  year: "2026",
};

interface TemplatePreviewProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
}

export default function TemplatePreview({
  open,
  template,
  onClose,
}: TemplatePreviewProps) {
  const [replacements, setReplacements] =
    useState<Record<string, string>>(sampleReplacements);
  const shouldReduce = useReducedMotion();
  const titleId = useId();

  const placeholders = useMemo(() => {
    if (!template) return [];
    const matches = template.content.match(/\{\{(\w+)\}\}/g);
    const subjectMatches = template.subject.match(/\{\{(\w+)\}\}/g);
    const all = new Set<string>();
    [...(matches || []), ...(subjectMatches || [])].forEach((m) => {
      all.add(m.slice(2, -2));
    });
    return [...all];
  }, [template]);

  const renderedSubject = useMemo(() => {
    if (!template) return "";
    let s = template.subject;
    Object.entries(replacements).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(v);
    });
    return s;
  }, [template, replacements]);

  const renderedHtml = useMemo(() => {
    if (!template) return "";
    let html = template.content;
    Object.entries(replacements).forEach(([k, v]) => {
      html = html.split(`{{${k}}}`).join(v);
    });
    return html;
  }, [template, replacements]);

  const resetReplacements = () => setReplacements(sampleReplacements);

  return (
    <Modal
      open={open && !!template}
      onClose={onClose}
      ariaLabelledBy={titleId}
      maxWidth={720}
      surfaceStyle={{ display: "flex", flexDirection: "column" }}
    >
      {template && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h2 id={titleId} style={{ margin: 0 }}>
                {template.slug}
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {renderedSubject}
              </p>
            </div>
            <div className="flex gap-2">
              <motion.button
                className="apple-btn apple-btn-secondary"
                onClick={resetReplacements}
                whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
                style={{ fontSize: 12, padding: "8px 12px", minHeight: 44 }}
              >
                Reset
              </motion.button>
              <motion.button
                className="apple-btn apple-btn-secondary"
                onClick={onClose}
                whileTap={{ scale: shouldReduce ? 1 : 0.97 }}
                style={{ fontSize: 12, padding: "8px 12px", minHeight: 44 }}
              >
                Close
              </motion.button>
            </div>
          </div>

          {placeholders.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: "12px 16px",
                background: "var(--bg-secondary)",
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  width: "100%",
                  marginBottom: 2,
                }}
              >
                Placeholder values
              </span>
              {placeholders.map((key) => (
                <div
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <label
                    htmlFor={`${titleId}-${key}`}
                    className="code"
                    style={{ fontSize: 11, color: "var(--text-secondary)" }}
                  >{`{{${key}}}`}</label>
                  <input
                    id={`${titleId}-${key}`}
                    className="apple-input code"
                    value={replacements[key] || ""}
                    onChange={(e) =>
                      setReplacements((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    style={{
                      width: 120,
                      fontSize: 12,
                      padding: "8px",
                      minHeight: 44,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              minHeight: 300,
            }}
          >
            <iframe
              srcDoc={renderedHtml}
              title="Template preview"
              sandbox=""
              tabIndex={-1}
              style={{
                width: "100%",
                height: 400,
                border: "none",
                display: "block",
              }}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
