"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/dashboard/properties", label: "Properties", icon: "🏢" },
  { href: "/dashboard/tenants", label: "Tenants", icon: "👥" },
  { href: "/dashboard/leases", label: "Leases", icon: "📄" },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: "🛠️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-brand-600 text-white font-bold flex items-center justify-center">
          P
        </div>
        <div>
          <div className="font-bold text-gray-900 leading-tight">PMS</div>
          <div className="text-xs text-gray-500 leading-tight">
            Property Management
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-500">
        v0.1.0
      </div>
    </aside>
  );
}
