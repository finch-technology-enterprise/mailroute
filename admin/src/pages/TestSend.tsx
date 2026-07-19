import { useState } from "react";
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
    <div>
      <h1 className="mb-6 text-2xl font-bold">Test Send</h1>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
          <input
            type="email"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="you@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Test email"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Content (HTML)</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            rows={10}
            placeholder="<h1>Hello!</h1><p>This is a test.</p>"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={sending}
        >
          {sending ? "Sending..." : "Send Test Email"}
        </button>
      </form>

      {result && (
        <div className={`mt-6 max-w-xl rounded-lg border p-4 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className={`text-sm font-medium ${result.success ? "text-green-700" : "text-red-700"}`}>
            {result.success ? "Sent successfully" : "Send failed"}
          </p>
          <p className="mt-1 text-sm text-gray-600">{result.message}</p>
        </div>
      )}
    </div>
  );
}
