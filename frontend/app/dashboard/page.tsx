"use client";

const STATS = [
  { label: "Properties", value: 12, accent: "text-brand-600" },
  { label: "Tenants", value: 38, accent: "text-emerald-600" },
  { label: "Active leases", value: 27, accent: "text-amber-600" },
  { label: "Open requests", value: 4, accent: "text-rose-600" },
];

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Overview of your portfolio at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className={`mt-1 text-3xl font-bold ${s.accent}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-2">Recent activity</h2>
        <p className="text-sm text-gray-500">
          No activity yet. Add a property or tenant to get started.
        </p>
      </div>
    </div>
  );
}
