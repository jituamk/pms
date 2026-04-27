'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBDT, formatDate } from '@/lib/money';

interface Line {
  id: number; line_type: string; label: string;
  quantity: string | null; rate: string | null; amount: string;
  meta: Record<string, unknown> | null;
  reading?: { previous_reading: string; current_reading: string; units_consumed: string; photo_path: string | null };
}
interface Payment {
  id: number; amount: string; payment_date: string; method: string;
  verification_status: string; transaction_id: string | null;
}
interface Bill {
  id: number; invoice_number: string; billing_month: string; due_date: string;
  rent_amount: string; utility_amount: string; service_amount: string; late_fee: string;
  adjustments: string; total_amount: string; paid_amount: string; balance_amount: string; status: string;
  lease?: { id: number; flat?: { flat_number: string; building?: { name: string } } };
  tenant?: { full_name: string; phone: string };
  lines?: Line[];
  payments?: Payment[];
}

const TONE: Record<string, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = {
  paid: 'green', partial: 'amber', unpaid: 'gray', overdue: 'red',
};

export default function BillDetailPage() {
  return (
    <AuthGuard>
      <AppShell><BillDetailInner /></AppShell>
    </AuthGuard>
  );
}

function BillDetailInner() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.get<Bill>(`/bills/${id}`).then(setBill).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <Card className="p-4 text-red-600">{err}</Card>;
  if (!bill) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/bills" className="text-sm text-gray-500 hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to bills</Link>
        <div className="flex items-center justify-between mt-1">
          <div>
            <h1 className="text-2xl font-semibold">{bill.invoice_number}</h1>
            <p className="text-sm text-gray-500">
              {formatDate(bill.billing_month)} · {bill.lease?.flat?.building?.name} · Flat {bill.lease?.flat?.flat_number} · {bill.tenant?.full_name}
            </p>
          </div>
          <Badge tone={TONE[bill.status] ?? 'gray'}>{bill.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-xs text-gray-500">Total</div><div className="text-lg font-semibold">{formatBDT(bill.total_amount)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-500">Paid</div><div className="text-lg font-semibold text-green-700">{formatBDT(bill.paid_amount)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-500">Balance</div><div className="text-lg font-semibold text-red-700">{formatBDT(bill.balance_amount)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-500">Due</div><div className="text-lg font-semibold">{formatDate(bill.due_date)}</div></Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Line items</div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(bill.lines ?? []).map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 capitalize">{l.line_type.replace('_', ' ')}</td>
                <td className="px-4 py-2">
                  {l.label}
                  {l.reading?.photo_path && <span className="ml-2 text-xs text-green-700">[meter photo]</span>}
                </td>
                <td className="px-4 py-2 text-right">{l.quantity ?? '—'}</td>
                <td className="px-4 py-2 text-right">{l.rate ? formatBDT(l.rate) : '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{formatBDT(l.amount)}</td>
              </tr>
            ))}
            {(bill.lines ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No line items.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr><td colSpan={4} className="px-4 py-2 text-right">Total</td><td className="px-4 py-2 text-right">{formatBDT(bill.total_amount)}</td></tr>
          </tfoot>
        </table>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Payments</div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Method</th>
              <th className="px-4 py-2 text-left">Txn ID</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(bill.payments ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{formatDate(p.payment_date)}</td>
                <td className="px-4 py-2 capitalize">{p.method}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.transaction_id ?? '—'}</td>
                <td className="px-4 py-2 text-right">{formatBDT(p.amount)}</td>
                <td className="px-4 py-2"><Badge tone={p.verification_status.includes('verified') ? 'green' : p.verification_status === 'rejected' ? 'red' : 'amber'}>{p.verification_status.replace('_', ' ')}</Badge></td>
              </tr>
            ))}
            {(bill.payments ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No payments yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
