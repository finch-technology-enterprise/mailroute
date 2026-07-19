import { ReactNode } from "react";

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

export default function Table<T>({ columns, data, keyExtractor, isLoading }: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {columns.map((col) => (
              <div key={col.key} className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
