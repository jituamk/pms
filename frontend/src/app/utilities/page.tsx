'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Settings as SettingsIcon } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';

type Allocation = 'per_meter' | 'shared' | 'fixed_flat';
type UtilityType = 'electricity' | 'water' | 'gas' | 'service_charge' | 'other';

interface Building { id: number; name: string }
interface UtilityRate {
  id: number;
  building_id: number;
  utility_type: UtilityType;
  label: string | null;
  allocation: Allocation;
  rate_per_unit: string;
  flat_fee: string;
  shared_total: string;
  active: boolean;
  apply_late_fee: boolean;
  notes: string | null;
  building?: Building;
}

const TYPE_LABEL: Record<UtilityType, string> = {
  electricity: 'Electricity',
  water: 'Water / WASA',
  gas: 'Gas / Titas',
  service_charge: 'Service charge',
  other: 'Other',
};
const ALLOC_LABEL: Record<Allocation, string> = {
  per_meter: 'Per meter',
  shared: 'Shared (split by occupied flats)',
  fixed_flat: 'Fixed per flat',
};

export default function UtilitiesPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant', 'super_admin']}>
      <AppShell><UtilitiesInner /></AppShell>
    </AuthGuard>
  );
}

function UtilitiesInner() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rates, setRates] = useState<UtilityRate[]>([]);
  const [filterBuilding, setFilterBuilding] = useState('');
  const [editing, setEditing] = useState<UtilityRate | 'new' | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [b, r] = await Promise.all([
      api.get<{ data: Building[] }>('/buildings'),
      api.get<UtilityRate[]>('/utility-rates' + (filterBuilding ? `?building_id=${filterBuilding}` : '')),
    ]);
    setBuildings(b.data ?? []);
    setRates(Array.isArray(r) ? r : []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [filterBuilding]);

  async function generateNow() {
    if (!generatingMonth) return;
    setGenMsg(null); setErr(null);
    try {
      const r = await api.post<{ generated: number; skipped: number; month: string }>(
        '/bills/generate', { month: generatingMonth }
      );
      setGenMsg(`Generated ${r.generated} bill(s), skipped ${r.skipped} for ${r.month}.`);
    } catch (e) { setErr((e as { message: string }).message); }
  }

  const grouped = useMemo(() => {
    const m = new Map<number, UtilityRate[]>();
    rates.forEach((r) => {
      const list = m.get(r.building_id) ?? [];
      list.push(r);
      m.set(r.building_id, list);
    });
    return m;
  }, [rates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Utilities</h1>
          <p className="text-sm text-gray-500">Configure utility rates per building. Bills are generated monthly on the 1st.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing('new')}><Plus size={16} /> New rate</Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Filter by building</Label>
            <select className="rounded-md border px-3 py-2 text-sm min-w-48" value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
              <option value="">All buildings</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-end gap-2">
            <div>
              <Label>Generate bills for month</Label>
              <Input type="month" value={generatingMonth ?? ''} onChange={(e) => setGeneratingMonth(e.target.value ? `${e.target.value}-01` : null)} />
            </div>
            <Button onClick={generateNow} disabled={!generatingMonth}>Generate now</Button>
          </div>
        </div>
        {genMsg && <div className="text-sm text-green-700">{genMsg}</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}
      </Card>

      {buildings.length === 0 && <Card className="p-6 text-sm text-gray-500">No buildings yet — add one first.</Card>}

      {buildings
        .filter((b) => !filterBuilding || String(b.id) === filterBuilding)
        .map((b) => {
          const list = grouped.get(b.id) ?? [];
          return (
            <Card key={b.id} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-gray-500">{list.length} rate(s)</div>
                </div>
                <Link href={`/utilities/${b.id}/meters`} className="text-sm text-brand-700 hover:underline inline-flex items-center gap-1">
                  <SettingsIcon size={14} /> Set up meters
                </Link>
              </div>
              <DataTable<UtilityRate>
                rows={list}
                empty="No rates configured for this building."
                columns={[
                  { key: 'utility_type', header: 'Type', render: (r) => <span>{TYPE_LABEL[r.utility_type]}{r.label ? <span className="text-gray-500"> · {r.label}</span> : null}</span> },
                  { key: 'allocation', header: 'Allocation', render: (r) => ALLOC_LABEL[r.allocation] },
                  { key: 'amount', header: 'Amount', render: (r) =>
                      r.allocation === 'per_meter' ? `${formatBDT(r.rate_per_unit)} / unit`
                      : r.allocation === 'shared' ? `${formatBDT(r.shared_total)} (total/month)`
                      : `${formatBDT(r.flat_fee)} / flat`
                  },
                  { key: 'late_fee', header: 'Late fee', render: (r) => r.apply_late_fee ? <Badge tone="amber">Yes</Badge> : <Badge tone="gray">No</Badge> },
                  { key: 'active', header: 'Status', render: (r) => r.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge> },
                  { key: 'actions', header: '', render: (r) => <Button variant="secondary" onClick={() => setEditing(r)}><Pencil size={14} /> Edit</Button> },
                ]}
              />
            </Card>
          );
        })}

      {editing && (
        <RateDialog
          rate={editing === 'new' ? null : editing}
          buildings={buildings}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RateDialog({
  rate, buildings, onClose, onSaved,
}: {
  rate: UtilityRate | null;
  buildings: Building[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    building_id: String(rate?.building_id ?? buildings[0]?.id ?? ''),
    utility_type: (rate?.utility_type ?? 'electricity') as UtilityType,
    label: rate?.label ?? '',
    allocation: (rate?.allocation ?? 'fixed_flat') as Allocation,
    rate_per_unit: rate?.rate_per_unit ?? '0',
    flat_fee: rate?.flat_fee ?? '0',
    shared_total: rate?.shared_total ?? '0',
    apply_late_fee: rate?.apply_late_fee ?? true,
    active: rate?.active ?? true,
    notes: rate?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const payload = {
        ...form,
        building_id: Number(form.building_id),
        rate_per_unit: Number(form.rate_per_unit || 0),
        flat_fee: Number(form.flat_fee || 0),
        shared_total: Number(form.shared_total || 0),
      };
      if (rate) {
        await api.patch(`/utility-rates/${rate.id}`, payload);
      } else {
        await api.post('/utility-rates', payload);
      }
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{rate ? 'Edit utility rate' : 'New utility rate'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Building</Label>
            <select required disabled={!!rate} className="w-full rounded-md border px-3 py-2 text-sm" value={form.building_id} onChange={(e) => setForm({ ...form, building_id: e.target.value })}>
              <option value="">Select…</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Utility type</Label>
            <select disabled={!!rate} className="w-full rounded-md border px-3 py-2 text-sm" value={form.utility_type} onChange={(e) => setForm({ ...form, utility_type: e.target.value as UtilityType })}>
              {(Object.keys(TYPE_LABEL) as UtilityType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <Label>Label (optional)</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. WASA, Lift maintenance" />
          </div>
          <div>
            <Label>Allocation method</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.allocation} onChange={(e) => setForm({ ...form, allocation: e.target.value as Allocation })}>
              {(Object.keys(ALLOC_LABEL) as Allocation[]).map((k) => <option key={k} value={k}>{ALLOC_LABEL[k]}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {form.allocation === 'per_meter' && 'Bill = (current − previous reading) × rate per unit. Set up a meter per flat.'}
              {form.allocation === 'shared' && 'Bill = total amount ÷ occupied flats. Update shared total each month.'}
              {form.allocation === 'fixed_flat' && 'Bill = flat fee per flat per month.'}
            </p>
          </div>
          {form.allocation === 'per_meter' && (
            <div><Label>Rate per unit (BDT)</Label><Input type="number" step="0.0001" value={form.rate_per_unit} onChange={(e) => setForm({ ...form, rate_per_unit: e.target.value })} /></div>
          )}
          {form.allocation === 'shared' && (
            <div><Label>Shared total this month (BDT)</Label><Input type="number" step="0.01" value={form.shared_total} onChange={(e) => setForm({ ...form, shared_total: e.target.value })} /></div>
          )}
          {form.allocation === 'fixed_flat' && (
            <div><Label>Flat fee (BDT/month)</Label><Input type="number" step="0.01" value={form.flat_fee} onChange={(e) => setForm({ ...form, flat_fee: e.target.value })} /></div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.apply_late_fee} onChange={(e) => setForm({ ...form, apply_late_fee: e.target.checked })} /> Apply late fee on overdue bills</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

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
