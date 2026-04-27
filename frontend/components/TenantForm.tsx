"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Property, Tenant } from "@/lib/types";

type Props = {
  initial?: Partial<Tenant>;
  onSubmit: (values: Partial<Tenant>) => Promise<void>;
  submitLabel: string;
};

export default function TenantForm({
  initial = {},
  onSubmit,
  submitLabel,
}: Props) {
  const [values, setValues] = useState<Partial<Tenant>>({
    name: "",
    email: "",
    phone: "",
    property_id: null,
    move_in_date: null,
    status: "prospect",
    ...initial,
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Property[] }>("/properties")
      .then((res) => setProperties(res.data ?? []))
      .catch(() => setProperties([]));
  }, []);

  function update<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition text-gray-900 placeholder-gray-400";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5"
    >
      <Field label="Name">
        <input
          required
          className={inputCls}
          value={values.name ?? ""}
          onChange={(e) => update("name", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Email">
          <input
            type="email"
            required
            className={inputCls}
            value={values.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={values.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Property">
          <select
            className={inputCls}
            value={values.property_id ?? ""}
            onChange={(e) =>
              update(
                "property_id",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          >
            <option value="">— None —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Move-in date">
          <input
            type="date"
            className={inputCls}
            value={values.move_in_date ?? ""}
            onChange={(e) =>
              update("move_in_date", e.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label="Status">
        <select
          className={inputCls}
          value={values.status}
          onChange={(e) => update("status", e.target.value as Tenant["status"])}
        >
          <option value="prospect">Prospect</option>
          <option value="active">Active</option>
          <option value="past">Past</option>
        </select>
      </Field>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition shadow-md shadow-brand-600/20 disabled:opacity-60"
      >
        {loading ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
