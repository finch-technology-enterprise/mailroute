import { useState } from "react";
import { motion } from "motion/react";
import { sendTestEmail } from "../api/admin";

export default function TestSend() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!to.trim()) { setError("Recipient email is required"); return; }
    if (!subject.trim()) { setError("Subject is required"); return; }
    if (!content.trim()) { setError("Content is required"); return; }

    setSending(true);
    try {
      const res = await sendTestEmail({ to, subject, content });
      setResult({ success: res.success, message: res.message || "Email sent" });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed to send" });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <h1 className="mb-8">Test Send</h1>

      <div className="card p-8" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="apple-label">To</label>
            <input
              type="email"
              className="apple-input"
              placeholder="you@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="apple-label">Subject</label>
            <input
              className="apple-input"
              placeholder="Test email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="apple-label">Content (HTML)</label>
            <textarea
              className="apple-input code"
              rows={10}
              placeholder="<h1>Hello!</h1>"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {error && <div className="apple-error">{error}</div>}

          <motion.button
            type="submit"
            className="apple-btn apple-btn-primary"
            disabled={sending}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", bounce: 0, duration: 0.12 }}
          >
            {sending ? "Sending..." : "Send Test Email"}
          </motion.button>
        </form>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className={result.success ? "apple-success mt-6" : "apple-error mt-6"}
          >
            <p style={{ fontWeight: 600, marginBottom: 2 }}>
              {result.success ? "Sent successfully" : "Send failed"}
            </p>
            <p style={{ opacity: 0.8 }}>{result.message}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
