'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT, formatDate } from '@/lib/money';

interface Lease {
  id: number; status: string; start_date: string; end_date: string | null; monthly_rent: string;
  tenant?: { full_name: string }; flat?: { flat_number: string; building?: { name: string } }; rent_policy?: { name: string }
}
interface Tenant { id: number; full_name: string }
interface Flat { id: number; flat_number: string; building?: { name: string } }
interface Policy { id: number; name: string }

const TONE: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  active: 'green', notice_period: 'amber', vacated: 'gray', terminated: 'red',
};

export default function LeasesPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell><LeasesInner /></AppShell>
    </AuthGuard>
  );
}

function LeasesInner() {
  const [rows, setRows] = useState<Lease[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Lease[] }>('/leases');
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leases</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New lease</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <DataTable<Lease>
        rows={rows}
        columns={[
          { key: 'tenant', header: 'Tenant', render: (r) => r.tenant?.full_name ?? '—' },
          { key: 'flat',   header: 'Flat',   render: (r) => `${r.flat?.building?.name ?? ''} · ${r.flat?.flat_number ?? ''}` },
          { key: 'monthly_rent', header: 'Rent', render: (r) => formatBDT(r.monthly_rent) },
          { key: 'start_date',   header: 'Start', render: (r) => formatDate(r.start_date) },
          { key: 'end_date',     header: 'End',   render: (r) => formatDate(r.end_date) },
          { key: 'status',       header: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.status.replace('_', ' ')}</Badge> },
        ]}
      />
      {open && <NewLeaseDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewLeaseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [flats, setFlats]       = useState<Flat[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  const [tenantId, setTenantId] = useState('');
  const [flatId, setFlatId]     = useState('');
  const [policyId, setPolicyId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rent, setRent] = useState('15000');
  const [deposit, setDeposit] = useState('15000');
  const [advance, setAdvance] = useState('30000');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Tenant[] }>('/tenants').then((r) => setTenants(r.data ?? []));
    api.get<{ data: Flat[] }>('/flats?status=vacant').then((r) => setFlats(r.data ?? []));
    api.get<Policy[]>('/rent-policies').then(setPolicies);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/leases', {
        tenant_id: parseInt(tenantId), flat_id: parseInt(flatId),
        rent_policy_id: parseInt(policyId), start_date: startDate,
        monthly_rent: parseFloat(rent), security_deposit: parseFloat(deposit), advance_rent: parseFloat(advance),
      });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New lease</h2>
        <form onSubmit={submit} className="space-y-3">
          <Select label="Tenant"     value={tenantId} onChange={setTenantId} options={tenants.map((t) => ({ value: t.id, label: t.full_name }))} />
          <Select label="Vacant flat" value={flatId}  onChange={setFlatId}  options={flats.map((f) => ({ value: f.id, label: `${f.building?.name ?? ''} · ${f.flat_number}` }))} />
          <Select label="Rent policy" value={policyId} onChange={setPolicyId} options={policies.map((p) => ({ value: p.id, label: p.name }))} />
          <div><Label>Start date</Label><Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label>Monthly rent</Label><Input required type="number" step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Security deposit</Label><Input type="number" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
            <div><Label>Advance rent</Label><Input type="number" step="0.01" value={advance} onChange={(e) => setAdvance(e.target.value)} /></div>
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: number; label: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <select required className="w-full rounded-md border px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
