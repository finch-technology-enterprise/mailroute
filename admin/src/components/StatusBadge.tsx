interface StatusBadgeProps {
  enabled: boolean;
  onToggle?: () => void;
}

export default function StatusBadge({ enabled, onToggle }: StatusBadgeProps) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors";
  const colors = enabled
    ? "bg-green-50 text-green-700"
    : "bg-gray-100 text-gray-500";

  return (
    <button className={`${base} ${colors} cursor-pointer`} onClick={onToggle} title="Toggle">
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-green-500" : "bg-gray-400"}`} />
      {enabled ? "Enabled" : "Disabled"}
    </button>
  );
}
