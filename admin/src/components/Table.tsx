import { ReactNode } from "react";
import { motion } from "motion/react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div
            className="skeleton"
            style={{
              height: 14,
              width: `${40 + Math.random() * 40}%`,
              background: "var(--border)",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <table className="apple-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} columns={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="apple-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <motion.tr
                key={keyExtractor(row)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 0.25,
                  delay: i * 0.03,
                }}
                className="card-hover"
                style={{ background: "transparent", cursor: "default", transition: "background 0.15s ease" }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
