"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TenantForm from "@/components/TenantForm";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Tenant }>(`/tenants/${params.id}`)
      .then((res) => setTenant(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load.")
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleUpdate(values: Partial<Tenant>) {
    await api(`/tenants/${params.id}`, {
      method: "PUT",
      body: JSON.stringify(values),
    });
    router.push("/dashboard/tenants");
  }

  async function handleDelete() {
    if (!confirm("Delete this tenant? This cannot be undone.")) return;
    await api(`/tenants/${params.id}`, { method: "DELETE" });
    router.push("/dashboard/tenants");
  }

  if (loading) return <div className="text-gray-500">Loading…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!tenant) return null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Edit tenant</h1>
        <button
          onClick={handleDelete}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-6">{tenant.name}</p>
      <TenantForm
        initial={tenant}
        onSubmit={handleUpdate}
        submitLabel="Save changes"
      />
    </div>
  );
}
