'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Home, Users, FileText, Wallet,
  Settings, ClipboardCheck,
} from 'lucide-react';
import { useAuth, type Role } from '@/lib/auth-context';
import { cn } from '@/lib/cn';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; roles: Role[] };

const NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard, roles: ['super_admin','owner','delegate','accountant','caretaker','tenant'] },
  { href: '/buildings',     label: 'Buildings',    icon: Building2,       roles: ['owner','delegate','accountant'] },
  { href: '/flats',         label: 'Flats',        icon: Home,            roles: ['owner','delegate','accountant'] },
  { href: '/tenants',       label: 'Tenants',      icon: Users,           roles: ['owner','delegate','accountant'] },
  { href: '/leases',        label: 'Leases',       icon: FileText,        roles: ['owner','delegate','accountant'] },
  { href: '/payments',      label: 'Payments',     icon: Wallet,          roles: ['owner','delegate','accountant','tenant'] },
  { href: '/rent-policies', label: 'Rent Policies',icon: ClipboardCheck,  roles: ['owner','delegate'] },
  { href: '/settings',      label: 'Settings',     icon: Settings,        roles: ['super_admin','owner','delegate','accountant','caretaker','tenant'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-white">
      <div className="px-5 py-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-brand-500 text-white grid place-items-center font-bold">P</div>
          <span className="font-semibold">PMS</span>
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {items.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.href || pathname?.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
                active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon size={18} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
