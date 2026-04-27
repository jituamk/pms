"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Property } from "@/lib/types";

export default function PropertiesListPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Property[] }>("/properties")
      .then((res) => setItems(res.data ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-600">
            All properties in your portfolio.
          </p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-600/20"
        >
          + Add property
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No properties yet.{" "}
            <Link
              href="/dashboard/properties/new"
              className="text-brand-600 font-medium"
            >
              Add your first one
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Address</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Units</th>
                <th className="text-right px-4 py-3 font-medium">Rent</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.address}, {p.city}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {p.type}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.units}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ${p.rent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === "available"
                          ? "bg-emerald-50 text-emerald-700"
                          : p.status === "occupied"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="text-brand-600 font-medium hover:text-brand-700"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
