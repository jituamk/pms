'use client';

import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatBDT, formatDate } from '@/lib/money';

interface Payment {
  id: number; payment_number: string; amount: string; payment_date: string; method: string;
  verification_status: string; transaction_id: string | null;
  tenant?: { full_name: string }; lease?: { flat?: { flat_number: string; building?: { name: string } } };
  proofs?: { id: number; file_path: string }[];
}
interface Lease { id: number; tenant?: { full_name: string }; flat?: { flat_number: string; building?: { name: string } }; monthly_rent: string }
interface OutstandingBill { id: number; invoice_number: string; billing_month: string; balance_amount: string; lease?: { id: number } }

const TONE: Record<string, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = {
  verified: 'green', auto_verified: 'green',
  manual_review: 'amber', pending: 'amber', pending_info: 'amber',
  rejected: 'red',
};

export default function PaymentsPage() {
  return (
    <AuthGuard>
      <AppShell><PaymentsInner /></AppShell>
    </AuthGuard>
  );
}

function PaymentsInner() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Payment[]>([]);
  const [open, setOpen] = useState(false);
  const [verifyOf, setVerifyOf] = useState<Payment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Payment[] }>('/payments');
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  const isStaff = user && ['owner', 'delegate', 'accountant', 'super_admin'].includes(user.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Record payment</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <DataTable<Payment>
        rows={rows}
        columns={[
          { key: 'payment_number', header: 'Receipt #' },
          { key: 'tenant',  header: 'Tenant', render: (r) => r.tenant?.full_name ?? '—' },
          { key: 'flat',    header: 'Flat',   render: (r) => r.lease?.flat?.flat_number ?? '—' },
          { key: 'amount',  header: 'Amount', render: (r) => formatBDT(r.amount) },
          { key: 'method',  header: 'Method', className: 'capitalize' },
          { key: 'date',    header: 'Date',   render: (r) => formatDate(r.payment_date) },
          { key: 'status',  header: 'Status', render: (r) => <Badge tone={TONE[r.verification_status] ?? 'gray'}>{r.verification_status.replace('_', ' ')}</Badge> },
          ...(isStaff ? [{ key: 'actions', header: '', render: (r: Payment) => (
            <Button variant="secondary" onClick={() => setVerifyOf(r)}>Review</Button>
          ) }] : []),
        ]}
      />
      {open && <NewPaymentDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
      {verifyOf && <VerifyDialog payment={verifyOf} onClose={() => setVerifyOf(null)} onSaved={() => { setVerifyOf(null); load(); }} />}
    </div>
  );
}

function NewPaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [leases, setLeases]   = useState<Lease[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [bills, setBills]     = useState<OutstandingBill[]>([]);
  const [billId, setBillId]   = useState('');
  const [amount, setAmount]   = useState('');
  const [date, setDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod]   = useState<'cash' | 'bkash' | 'rocket' | 'nagad' | 'bank_transfer' | 'cheque' | 'other'>('cash');
  const [txn, setTxn]         = useState('');
  const [files, setFiles]     = useState<File[]>([]);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'tenant') {
      api.get<{ lease?: Lease }>('/dashboard').then((d) => {
        if (d.lease) { setLeases([d.lease]); setLeaseId(String(d.lease.id)); }
      });
    } else {
      api.get<{ data: Lease[] }>('/leases?status=active').then((r) => setLeases(r.data ?? []));
    }
  }, [user]);

  // Load outstanding bills when a lease is picked
  useEffect(() => {
    if (!leaseId) { setBills([]); setBillId(''); return; }
    api.get<{ data: OutstandingBill[] }>(`/bills?lease_id=${leaseId}&status=unpaid`).then((r) => setBills(r.data ?? []));
  }, [leaseId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('lease_id', leaseId);
      if (billId) fd.append('invoice_id', billId);
      fd.append('amount', amount);
      fd.append('payment_date', date);
      fd.append('method', method);
      if (txn) fd.append('transaction_id', txn);
      files.forEach((f) => fd.append('proofs[]', f));
      await api.post('/payments', fd);
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Record payment</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Lease</Label>
            <select required className="w-full rounded-md border px-3 py-2 text-sm" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}>
              <option value="">Select…</option>
              {leases.map((l) => <option key={l.id} value={l.id}>{l.tenant?.full_name} · {l.flat?.flat_number}</option>)}
            </select>
          </div>
          {bills.length > 0 && (
            <div>
              <Label>Apply to bill (optional)</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={billId} onChange={(e) => {
                setBillId(e.target.value);
                const b = bills.find((x) => String(x.id) === e.target.value);
                if (b) setAmount(b.balance_amount);
              }}>
                <option value="">Don&apos;t link</option>
                {bills.map((b) => <option key={b.id} value={b.id}>{b.invoice_number} · balance ৳{b.balance_amount}</option>)}
              </select>
            </div>
          )}
          <div><Label>Amount (BDT)</Label><Input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Date</Label><Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Method</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="cash">Cash</option><option value="bkash">bKash</option>
              <option value="rocket">Rocket</option><option value="nagad">Nagad</option>
              <option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          {method !== 'cash' && (
            <div><Label>Transaction ID</Label><Input value={txn} onChange={(e) => setTxn(e.target.value)} /></div>
          )}
          <div>
            <Label>Proof images (optional)</Label>
            <Input type="file" multiple accept="image/*,.pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function VerifyDialog({ payment, onClose, onSaved }: { payment: Payment; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(result: 'verified' | 'rejected') {
    setBusy(true); setErr(null);
    try {
      await api.post(`/payments/${payment.id}/verify`, { result, reason });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Review payment {payment.payment_number}</h2>
        <p className="text-sm text-gray-500 mb-4">{payment.tenant?.full_name} · {formatBDT(payment.amount)} · {payment.method} · txn {payment.transaction_id ?? '—'}</p>

        {payment.proofs && payment.proofs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {payment.proofs.map((p) => (
              <div key={p.id} className="text-xs bg-gray-100 rounded p-2 break-all">{p.file_path}</div>
            ))}
          </div>
        )}

        <Label>Notes / reason (optional)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" />

        {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => decide('rejected')} disabled={busy}><X size={16} /> Reject</Button>
          <Button onClick={() => decide('verified')} disabled={busy}><Check size={16} /> Verify</Button>
        </div>
      </Card>
    </div>
  );
}
