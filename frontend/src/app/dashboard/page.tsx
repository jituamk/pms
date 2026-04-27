'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

function PendingAckBanner() {
  const [ack, setAck] = useState<{ id: number; status: string } | null>(null);
  useEffect(() => {
    api.get<{ id: number; status: string }[]>('/acknowledgements')
      .then((rs) => {
        const pending = rs.find((r) => r.status === 'pending' || r.status === 'partial');
        if (pending) setAck(pending);
      })
      .catch(() => {});
  }, []);
  if (!ack) return null;
  return (
    <Card className="p-4 bg-amber-50 border-amber-200">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-amber-800">
          <strong>Action required.</strong> Please review and acknowledge the assets in your flat.
        </div>
        <Link href={`/acknowledgements/${ack.id}`} className="rounded-md bg-amber-600 text-white text-sm px-3 py-1.5 hover:bg-amber-700">
          Review now
        </Link>
      </div>
    </Card>
  );
}

function TenantDashboard({ data }: { data: unknown }) {
  const d = data as {
    tenant: { full_name: string };
    lease?: { monthly_rent: string; start_date: string; flat: { flat_number: string; building: { name: string } } };
    payments: Payment[];
    outstanding_bills?: { id: number; invoice_number: string; billing_month: string; due_date: string; balance_amount: string; status: string }[];
    total_due?: number;
  };
  const totalDue = d.total_due ?? 0;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hello, {d.tenant.full_name}</h1>
      <PendingAckBanner />
      {totalDue > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-amber-900">You have {(d.outstanding_bills ?? []).length} outstanding bill(s)</div>
              <div className="text-2xl font-bold text-amber-900">{formatBDT(totalDue)} due</div>
            </div>
            <div className="flex gap-2">
              <Link href="/bills" className="text-sm rounded-md bg-amber-600 text-white px-4 py-2">View bills</Link>
              <Link href="/payments" className="text-sm rounded-md bg-brand-600 text-white px-4 py-2">Pay now</Link>
            </div>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {(d.outstanding_bills ?? []).slice(0, 3).map((b) => (
              <li key={b.id} className="py-2 flex justify-between">
                <Link href={`/bills/${b.id}`} className="text-brand-700 hover:underline">{b.invoice_number}</Link>
                <span>Due {formatDate(b.due_date)} · <span className="font-medium">{formatBDT(b.balance_amount)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
