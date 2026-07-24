interface SkeletonProps {
  count?: number;
  height?: number | string;
  width?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ count = 3, height = 14, width = "80%", style }: SkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{ height, width, ...style }}
        />
      ))}
    </div>
  );
}
