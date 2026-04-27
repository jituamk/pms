'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT, formatDate } from '@/lib/money';

interface Bill {
  id: number; invoice_number: string; billing_month: string; due_date: string;
  rent_amount: string; utility_amount: string; service_amount: string; late_fee: string;
  total_amount: string; paid_amount: string; balance_amount: string; status: string;
  lease?: { flat?: { flat_number: string; building?: { name: string } } };
  tenant?: { full_name: string };
  lines_count?: number;
}

const TONE: Record<string, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = {
  paid: 'green', partial: 'amber', unpaid: 'gray', overdue: 'red',
};

export default function BillsPage() {
  return (
    <AuthGuard>
      <AppShell><BillsInner /></AppShell>
    </AuthGuard>
  );
}

function BillsInner() {
  const [rows, setRows] = useState<Bill[]>([]);
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (month)  q.set('month', `${month}-01`);
    const r = await api.get<{ data: Bill[] }>('/bills' + (q.toString() ? '?' + q.toString() : ''));
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [status, month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div>
          <Label>Status</Label>
          <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div>
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </Card>

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      <DataTable<Bill>
        rows={rows}
        empty="No bills yet."
        columns={[
          { key: 'invoice_number', header: 'Invoice #', render: (r) => <Link href={`/bills/${r.id}`} className="text-brand-700 hover:underline">{r.invoice_number}</Link> },
          { key: 'month',  header: 'Month',  render: (r) => formatDate(r.billing_month) },
          { key: 'tenant', header: 'Tenant', render: (r) => r.tenant?.full_name ?? '—' },
          { key: 'flat',   header: 'Flat',   render: (r) => r.lease?.flat?.flat_number ?? '—' },
          { key: 'rent',   header: 'Rent',   render: (r) => formatBDT(r.rent_amount) },
          { key: 'utilities', header: 'Utilities', render: (r) => formatBDT(Number(r.utility_amount) + Number(r.service_amount)) },
          { key: 'late_fee', header: 'Late fee', render: (r) => formatBDT(r.late_fee) },
          { key: 'total',  header: 'Total',  render: (r) => <strong>{formatBDT(r.total_amount)}</strong> },
          { key: 'paid',   header: 'Paid',   render: (r) => formatBDT(r.paid_amount) },
          { key: 'balance',header: 'Balance',render: (r) => formatBDT(r.balance_amount) },
          { key: 'due',    header: 'Due',    render: (r) => formatDate(r.due_date) },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status] ?? 'gray'}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
