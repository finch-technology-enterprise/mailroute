interface InlineErrorProps {
  error: string;
  onRetry?: () => void;
}

export default function InlineError({ error, onRetry }: InlineErrorProps) {
  if (onRetry) {
    return (
      <div className="apple-error mb-6 flex items-center justify-between">
        <span>{error}</span>
        <button className="apple-link" style={{ fontSize: 12 }} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,69,58,0.1)", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>
      {error}
    </div>
  );
}
