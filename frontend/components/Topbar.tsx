"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center text-sm">
          {initials}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-700 hover:text-red-600 transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
