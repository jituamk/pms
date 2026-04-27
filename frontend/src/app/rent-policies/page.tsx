'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';

interface Policy { id: number; name: string; due_day: number; grace_period_days: number; late_fee_method: string; late_fee_percentage: string | null; is_default: boolean; notice_period_months: number; minimum_stay_months: number }

export default function PoliciesPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate']}>
      <AppShell><PoliciesInner /></AppShell>
    </AuthGuard>
  );
}

function PoliciesInner() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<Policy[]>('/rent-policies');
    setRows(r);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rent policies</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New policy</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <DataTable<Policy>
        rows={rows}
        columns={[
          { key: 'name', header: 'Name', render: (r) => <span>{r.name}{r.is_default && <span className="ml-2 text-xs text-brand-700">(default)</span>}</span> },
          { key: 'due_day', header: 'Due day' },
          { key: 'grace_period_days', header: 'Grace (days)' },
          { key: 'late_fee_method', header: 'Late fee', render: (r) => `${r.late_fee_method}${r.late_fee_percentage ? ` ${r.late_fee_percentage}%/d` : ''}` },
          { key: 'notice_period_months', header: 'Notice (mo)' },
          { key: 'minimum_stay_months', header: 'Min stay (mo)' },
        ]}
      />
      {open && <NewPolicyDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewPolicyDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('Standard');
  const [dueDay, setDueDay] = useState(5);
  const [grace, setGrace] = useState(3);
  const [method, setMethod] = useState<'percentage' | 'flat' | 'tiered'>('percentage');
  const [pct, setPct] = useState('1');
  const [flat, setFlat] = useState('500');
  const [notice, setNotice] = useState(1);
  const [minStay, setMinStay] = useState(6);
  const [advance, setAdvance] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/rent-policies', {
        name, due_day: dueDay, grace_period_days: grace,
        late_fee_method: method,
        late_fee_percentage: method === 'percentage' ? parseFloat(pct) : null,
        late_fee_flat_amount: method === 'flat' ? parseFloat(flat) : null,
        notice_period_months: notice, minimum_stay_months: minStay, advance_rent_months: advance,
        security_deposit_required: true,
      });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New rent policy</h2>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Due day</Label><Input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(parseInt(e.target.value || '5'))} /></div>
            <div><Label>Grace (days)</Label><Input type="number" min={0} value={grace} onChange={(e) => setGrace(parseInt(e.target.value || '0'))} /></div>
          </div>
          <div>
            <Label>Late fee method</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="percentage">Percentage / day</option>
              <option value="flat">Flat amount</option>
              <option value="tiered">Tiered (configure later)</option>
            </select>
          </div>
          {method === 'percentage' && <div><Label>Percentage / day</Label><Input type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} /></div>}
          {method === 'flat' && <div><Label>Flat amount</Label><Input type="number" step="0.01" value={flat} onChange={(e) => setFlat(e.target.value)} /></div>}
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Notice (mo)</Label><Input type="number" min={0} value={notice} onChange={(e) => setNotice(parseInt(e.target.value || '0'))} /></div>
            <div><Label>Min stay (mo)</Label><Input type="number" min={0} value={minStay} onChange={(e) => setMinStay(parseInt(e.target.value || '0'))} /></div>
            <div><Label>Advance (mo)</Label><Input type="number" min={0} value={advance} onChange={(e) => setAdvance(parseInt(e.target.value || '0'))} /></div>
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
