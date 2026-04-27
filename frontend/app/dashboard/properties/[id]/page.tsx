"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PropertyForm from "@/components/PropertyForm";
import { api } from "@/lib/api";
import type { Property } from "@/lib/types";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Property }>(`/properties/${params.id}`)
      .then((res) => setProperty(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load.")
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleUpdate(values: Partial<Property>) {
    await api(`/properties/${params.id}`, {
      method: "PUT",
      body: JSON.stringify(values),
    });
    router.push("/dashboard/properties");
  }

  async function handleDelete() {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    await api(`/properties/${params.id}`, { method: "DELETE" });
    router.push("/dashboard/properties");
  }

  if (loading) return <div className="text-gray-500">Loading…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!property) return null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Edit property</h1>
        <button
          onClick={handleDelete}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-6">{property.name}</p>
      <PropertyForm
        initial={property}
        onSubmit={handleUpdate}
        submitLabel="Save changes"
      />
    </div>
  );
}
