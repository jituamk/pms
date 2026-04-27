"use client";

import { FormEvent, useState } from "react";
import type { Property } from "@/lib/types";

type Props = {
  initial?: Partial<Property>;
  onSubmit: (values: Partial<Property>) => Promise<void>;
  submitLabel: string;
};

export default function PropertyForm({
  initial = {},
  onSubmit,
  submitLabel,
}: Props) {
  const [values, setValues] = useState<Partial<Property>>({
    name: "",
    address: "",
    city: "",
    type: "apartment",
    units: 1,
    rent: 0,
    status: "available",
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Property>(key: K, value: Property[K]) {
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
        <Field label="Address">
          <input
            required
            className={inputCls}
            value={values.address ?? ""}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            required
            className={inputCls}
            value={values.city ?? ""}
            onChange={(e) => update("city", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="Type">
          <select
            className={inputCls}
            value={values.type}
            onChange={(e) =>
              update("type", e.target.value as Property["type"])
            }
          >
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="commercial">Commercial</option>
            <option value="land">Land</option>
          </select>
        </Field>
        <Field label="Units">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={values.units ?? 1}
            onChange={(e) => update("units", Number(e.target.value))}
          />
        </Field>
        <Field label="Rent (USD/mo)">
          <input
            type="number"
            min={0}
            step={50}
            className={inputCls}
            value={values.rent ?? 0}
            onChange={(e) => update("rent", Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Status">
        <select
          className={inputCls}
          value={values.status}
          onChange={(e) =>
            update("status", e.target.value as Property["status"])
          }
        >
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
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
