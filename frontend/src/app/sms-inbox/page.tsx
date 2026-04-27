'use client';

import { useEffect, useState } from 'react';
import { Plus, Link2, Ban } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT, formatDate } from '@/lib/money';

interface Sms {
  id: number; provider: string; sender: string | null; raw_body: string;
  transaction_id: string | null; amount: string | null; counterparty_phone: string | null;
  received_at: string; status: 'unparsed' | 'unmatched' | 'matched' | 'ignored';
  matched_payment_id: number | null;
  payment?: { payment_number: string; amount: string; verification_status: string };
}
interface Payment {
  id: number; payment_number: string; amount: string; method: string; transaction_id: string | null;
  verification_status: string; tenant?: { full_name: string };
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = {
  matched: 'green', unmatched: 'amber', unparsed: 'red', ignored: 'gray',
};

export default function SmsInboxPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'super_admin']}>
      <AppShell><SmsInboxInner /></AppShell>
    </AuthGuard>
  );
}

function SmsInboxInner() {
  const [rows, setRows] = useState<Sms[]>([]);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [matching, setMatching] = useState<Sms | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const q = status ? `?status=${status}` : '';
    const r = await api.get<{ data: Sms[] }>('/sms-inbox' + q);
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [status]);

  async function ignore(s: Sms) {
    await api.post(`/sms-inbox/${s.id}/ignore`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SMS Inbox</h1>
          <p className="text-sm text-gray-500">Inbound bKash / Nagad / Rocket SMS auto-match recorded payments by transaction ID.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Paste SMS</Button>
      </div>

      <Card className="p-3">
        <div className="flex items-end gap-3">
          <div>
            <Label>Status</Label>
            <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="unparsed">Unparsed</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
        </div>
      </Card>

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      <DataTable<Sms>
        rows={rows}
        empty="No SMS yet."
        columns={[
          { key: 'received', header: 'Received', render: (r) => formatDate(r.received_at) },
          { key: 'provider', header: 'Provider', className: 'capitalize' },
          { key: 'txn', header: 'Txn ID', render: (r) => <span className="font-mono text-xs">{r.transaction_id ?? '—'}</span> },
          { key: 'amount', header: 'Amount', render: (r) => r.amount ? formatBDT(r.amount) : '—' },
          { key: 'phone', header: 'From', render: (r) => r.counterparty_phone ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'gray'}>{r.status}</Badge> },
          { key: 'matched', header: 'Payment', render: (r) => r.payment ? <span className="text-xs text-green-700">{r.payment.payment_number}</span> : '—' },
          { key: 'actions', header: '', render: (r) => (
            r.status === 'unmatched' ? (
              <div className="flex gap-1">
                <Button variant="secondary" onClick={() => setMatching(r)}><Link2 size={14} /> Match</Button>
                <Button variant="ghost" onClick={() => ignore(r)}><Ban size={14} /></Button>
              </div>
            ) : null
          ) },
        ]}
      />

      {open && <PasteSmsDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
      {matching && <MatchDialog sms={matching} onClose={() => setMatching(null)} onSaved={() => { setMatching(null); load(); }} />}
    </div>
  );
}

function PasteSmsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [sender, setSender] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/sms-inbox', { sender, body });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Paste SMS</h2>
        <p className="text-sm text-gray-500 mb-3">Paste the full SMS body. We&apos;ll detect bKash / Nagad / Rocket and try to auto-match.</p>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Sender (shortcode or phone)</Label><Input required value={sender} onChange={(e) => setSender(e.target.value)} placeholder="e.g. 16216 or bKash" /></div>
          <div>
            <Label>Body</Label>
            <textarea required rows={5} className="w-full rounded-md border px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Ingest'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function MatchDialog({ sms, onClose, onSaved }: { sms: Sms; onClose: () => void; onSaved: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pid, setPid] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Payment[] }>('/payments?status=manual_review').then((r) => setPayments(r.data ?? []));
  }, []);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await api.post(`/sms-inbox/${sms.id}/match`, { payment_id: Number(pid) });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Match SMS to payment</h2>
        <p className="text-xs text-gray-500 mb-3 font-mono whitespace-pre-wrap break-all">{sms.raw_body}</p>
        <Label>Pick a payment</Label>
        <select className="w-full rounded-md border px-3 py-2 text-sm mb-3" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Select…</option>
          {payments.map((p) => (
            <option key={p.id} value={p.id}>
              {p.payment_number} · {p.tenant?.full_name ?? ''} · {formatBDT(p.amount)} · {p.method}{p.transaction_id ? ` · ${p.transaction_id}` : ''}
            </option>
          ))}
        </select>
        {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !pid}>Match & verify</Button>
        </div>
      </Card>
    </div>
  );
}
