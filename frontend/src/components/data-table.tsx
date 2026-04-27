'use client';

import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends { id: number | string }>({
  columns, rows, empty = 'No records.',
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-2 text-left font-semibold text-gray-600', c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500">{empty}</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-2', c.className)}>
                  {c.render ? c.render(r) : (r as Record<string, unknown>)[c.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
