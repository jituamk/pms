'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';

interface Inspection {
  id: number;
  status: 'draft' | 'finalized';
  total_damage_charge: string;
  deposit_amount: string;
  deposit_refund: string;
  inspected_at: string | null;
  finalized_at: string | null;
  lease?: {
    id: number;
    flat?: { flat_number: string; building?: { name: string } };
    tenant?: { full_name: string };
    status: string;
  };
}

interface Lease {
  id: number;
  status: string;
  flat?: { flat_number: string; building?: { name: string } };
  tenant?: { full_name: string };
}

export default function InspectionsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate']}>
      <AppShell><Inner /></AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const [rows, setRows] = useState<Inspection[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api.get<Inspection[]>('/inspections');
      setRows(r);
    } catch (e) {
      setErr((e as { message: string }).message);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Search size={22} /> Move-out inspections
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Inspect a vacated flat, mark damaged or missing assets, and finalize deposit refunds.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New inspection</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      <div className="grid gap-2">
        {rows.map((i) => (
          <Link
            key={i.id}
            href={`/inspections/${i.id}`}
            className="block rounded-lg border bg-white p-4 hover:border-brand-500 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {i.lease?.flat?.building?.name ?? 'Building'} · Flat {i.lease?.flat?.flat_number ?? '—'}
                </div>
                <div className="text-xs text-gray-500">
                  Tenant: {i.lease?.tenant?.full_name ?? '—'} ·
                  Damage {formatBDT(i.total_damage_charge)} · Refund {formatBDT(i.deposit_refund)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={i.status === 'finalized' ? 'green' : 'amber'}>{i.status}</Badge>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 && !err && (
          <Card className="p-6 text-sm text-gray-500 text-center">No inspections yet.</Card>
        )}
      </div>
      {open && <NewInspectionDialog onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewInspectionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Lease[] }>('/leases?status=vacated')
      .then((r) => setLeases(r.data ?? []))
      .catch(() => setLeases([]));
  }, []);

  async function start() {
    if (!leaseId) return;
    setBusy(true); setErr(null);
    try {
      await api.post(`/leases/${leaseId}/inspections/start`, {});
      onCreated();
    } catch (e) {
      setErr((e as { message: string }).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">Start inspection</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pick a vacated lease. The system will pre-populate items from the move-in snapshot.
        </p>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm mb-3"
          value={leaseId}
          onChange={(e) => setLeaseId(e.target.value)}
        >
          <option value="">Select lease…</option>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.flat?.building?.name} · {l.flat?.flat_number} · {l.tenant?.full_name}
            </option>
          ))}
        </select>
        {leases.length === 0 && <p className="text-xs text-gray-500 mb-3">No vacated leases. Terminate a lease first.</p>}
        {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={start} disabled={busy || !leaseId}>{busy ? 'Starting…' : 'Start'}</Button>
        </div>
      </Card>
    </div>
  );
}
