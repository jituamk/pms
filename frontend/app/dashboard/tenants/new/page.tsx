"use client";

import { useRouter } from "next/navigation";
import TenantForm from "@/components/TenantForm";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";

export default function NewTenantPage() {
  const router = useRouter();

  async function handleCreate(values: Partial<Tenant>) {
    await api("/tenants", {
      method: "POST",
      body: JSON.stringify(values),
    });
    router.push("/dashboard/tenants");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New tenant</h1>
      <p className="text-sm text-gray-600 mb-6">Add a tenant.</p>
      <TenantForm onSubmit={handleCreate} submitLabel="Create tenant" />
    </div>
  );
}
