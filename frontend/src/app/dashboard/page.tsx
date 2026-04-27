'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatBDT, formatDate } from '@/lib/money';

interface OwnerKpis {
  total_buildings: number; total_flats: number; occupied_flats: number; vacant_flats: number;
  occupancy_rate: number; total_tenants: number; active_leases: number;
  collected_this_month: number; pending_verification: number;
}
interface Payment { id: number; amount: string; payment_date: string; method: string; tenant?: { full_name: string }; lease?: { flat?: { flat_number: string } } }

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AppShell>
        <DashboardInner />
      </AppShell>
    </AuthGuard>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const [data, setData] = useState<{ kpis?: OwnerKpis; recent_payments?: Payment[] } | null>(null);
  const [err, setErr]   = useState<string | null>(null);

  useEffect(() => {
    api.get<typeof data>('/dashboard').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="text-red-600">{err}</div>;
  if (!data) return <div className="text-gray-500">Loading…</div>;

  if (user?.role === 'tenant') {
    return <TenantDashboard data={data as unknown} />;
  }

  const k = data.kpis;
  if (!k) return <div className="text-gray-500">No data.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Buildings"         value={k.total_buildings} />
        <Stat label="Flats"             value={k.total_flats} />
        <Stat label="Occupied"          value={`${k.occupied_flats} / ${k.total_flats}`} hint={`${k.occupancy_rate}% occupancy`} />
        <Stat label="Active leases"     value={k.active_leases} />
        <Stat label="Tenants"           value={k.total_tenants} />
        <Stat label="Collected (month)" value={formatBDT(k.collected_this_month)} />
        <Stat label="Pending verify"    value={k.pending_verification} tone={k.pending_verification > 0 ? 'amber' : 'gray'} />
        <Stat label="Vacant flats"      value={k.vacant_flats} />
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Recent payments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr><th className="py-2">Date</th><th>Tenant</th><th>Flat</th><th>Method</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y">
              {(data.recent_payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{formatDate(p.payment_date)}</td>
                  <td>{p.tenant?.full_name ?? '—'}</td>
                  <td>{p.lease?.flat?.flat_number ?? '—'}</td>
                  <td className="capitalize">{p.method}</td>
                  <td className="text-right">{formatBDT(p.amount)}</td>
                </tr>
              ))}
              {(data.recent_payments ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-500">No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone = 'gray' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'gray' | 'amber' | 'green' }) {
  const ring = tone === 'amber' ? 'ring-amber-200' : tone === 'green' ? 'ring-green-200' : 'ring-gray-200';
  return (
    <Card className={`p-4 ring-1 ${ring}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </Card>
  );
}

function TenantDashboard({ data }: { data: unknown }) {
  const d = data as { tenant: { full_name: string }; lease?: { monthly_rent: string; start_date: string; flat: { flat_number: string; building: { name: string } } }; payments: Payment[] };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hello, {d.tenant.full_name}</h1>
      {d.lease ? (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Your lease</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Building: </span>{d.lease.flat.building.name}</div>
            <div><span className="text-gray-500">Flat: </span>{d.lease.flat.flat_number}</div>
            <div><span className="text-gray-500">Rent: </span>{formatBDT(d.lease.monthly_rent)}</div>
            <div><span className="text-gray-500">Started: </span>{formatDate(d.lease.start_date)}</div>
          </div>
        </Card>
      ) : <Card className="p-4 text-gray-500">No active lease.</Card>}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Recent payments</h2>
        <ul className="divide-y text-sm">
          {d.payments.map((p) => (
            <li key={p.id} className="py-2 flex justify-between">
              <span>{formatDate(p.payment_date)} · {p.method}</span>
              <span className="font-medium">{formatBDT(p.amount)}</span>
            </li>
          ))}
          {d.payments.length === 0 && <li className="py-2 text-gray-500">No payments yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
