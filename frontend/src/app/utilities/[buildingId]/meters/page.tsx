'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';

interface Flat { id: number; flat_number: string; building_id: number }
interface Rate { id: number; building_id: number; utility_type: string; label: string | null; allocation: string; rate_per_unit: string }
interface Meter {
  id: number; flat_id: number; utility_rate_id: number; meter_number: string | null;
  opening_reading: string; active: boolean;
  flat?: Flat; rate?: Rate;
}
interface Building { id: number; name: string }

export default function MetersPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant', 'super_admin']}>
      <AppShell><MetersInner /></AppShell>
    </AuthGuard>
  );
}

function MetersInner() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [b, m, f, r] = await Promise.all([
      api.get<Building>(`/buildings/${buildingId}`),
      api.get<Meter[]>(`/utility-meters?building_id=${buildingId}`),
      api.get<{ data: Flat[] }>(`/flats?building_id=${buildingId}`),
      api.get<Rate[]>(`/utility-rates?building_id=${buildingId}&active=true`),
    ]);
    setBuilding(b);
    setMeters(Array.isArray(m) ? m : []);
    setFlats(f.data ?? []);
    setRates(Array.isArray(r) ? r.filter((x) => x.allocation === 'per_meter') : []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [buildingId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/utilities" className="text-sm text-gray-500 hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to utilities</Link>
          <h1 className="text-2xl font-semibold mt-1">Meters · {building?.name ?? '…'}</h1>
          <p className="text-sm text-gray-500">One meter per flat per per-meter utility rate.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={rates.length === 0 || flats.length === 0}>
          <Plus size={16} /> Add meter
        </Button>
      </div>

      {rates.length === 0 && (
        <Card className="p-4 text-sm text-amber-700 bg-amber-50">
          No per-meter rates configured. <Link className="underline" href="/utilities">Add a rate</Link> with allocation = per meter first.
        </Card>
      )}

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      <DataTable<Meter>
        rows={meters}
        empty="No meters yet."
        columns={[
          { key: 'flat', header: 'Flat', render: (r) => r.flat?.flat_number ?? '—' },
          { key: 'rate', header: 'Utility', render: (r) => <span className="capitalize">{r.rate?.utility_type?.replace('_', ' ')}{r.rate?.label ? ` · ${r.rate.label}` : ''}</span> },
          { key: 'meter_number', header: 'Meter #', render: (r) => r.meter_number ?? '—' },
          { key: 'opening_reading', header: 'Opening', render: (r) => r.opening_reading },
          { key: 'rate_per_unit', header: 'Rate', render: (r) => formatBDT(r.rate?.rate_per_unit ?? 0) + ' / unit' },
          { key: 'active', header: 'Status', render: (r) => r.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge> },
        ]}
      />

      {open && (
        <NewMeterDialog flats={flats} rates={rates} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
      )}
    </div>
  );
}

function NewMeterDialog({
  flats, rates, onClose, onSaved,
}: {
  flats: Flat[]; rates: Rate[]; onClose: () => void; onSaved: () => void;
}) {
  const [flatId, setFlatId] = useState(String(flats[0]?.id ?? ''));
  const [rateId, setRateId] = useState(String(rates[0]?.id ?? ''));
  const [meterNumber, setMeterNumber] = useState('');
  const [opening, setOpening] = useState('0');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/utility-meters', {
        flat_id: Number(flatId),
        utility_rate_id: Number(rateId),
        meter_number: meterNumber || null,
        opening_reading: Number(opening || 0),
      });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Add meter</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Flat</Label>
            <select required className="w-full rounded-md border px-3 py-2 text-sm" value={flatId} onChange={(e) => setFlatId(e.target.value)}>
              {flats.map((f) => <option key={f.id} value={f.id}>{f.flat_number}</option>)}
            </select>
          </div>
          <div>
            <Label>Utility</Label>
            <select required className="w-full rounded-md border px-3 py-2 text-sm" value={rateId} onChange={(e) => setRateId(e.target.value)}>
              {rates.map((r) => <option key={r.id} value={r.id}>{r.utility_type}{r.label ? ` · ${r.label}` : ''} ({formatBDT(r.rate_per_unit)}/unit)</option>)}
            </select>
          </div>
          <div><Label>Meter number</Label><Input value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} /></div>
          <div><Label>Opening reading</Label><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>

          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
