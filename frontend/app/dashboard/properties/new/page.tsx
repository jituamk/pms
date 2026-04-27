"use client";

import { useRouter } from "next/navigation";
import PropertyForm from "@/components/PropertyForm";
import { api } from "@/lib/api";
import type { Property } from "@/lib/types";

export default function NewPropertyPage() {
  const router = useRouter();

  async function handleCreate(values: Partial<Property>) {
    await api("/properties", {
      method: "POST",
      body: JSON.stringify(values),
    });
    router.push("/dashboard/properties");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New property</h1>
      <p className="text-sm text-gray-600 mb-6">
        Add a property to your portfolio.
      </p>
      <PropertyForm onSubmit={handleCreate} submitLabel="Create property" />
    </div>
  );
}
