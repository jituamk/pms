'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';

interface Flat { id: number; flat_number: string; bedrooms: number; bathrooms: number; size_sqft: string | null; base_rent: string; status: string; building?: { name: string }; floor?: { name: string } }
interface Building { id: number; name: string; total_floors: number }
interface Floor { id: number; name: string; level: number }

export default function FlatsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell><FlatsInner /></AppShell>
    </AuthGuard>
  );
}

const TONE: Record<string, 'green' | 'amber' | 'gray' | 'blue'> = {
  occupied: 'green', vacant: 'gray', reserved: 'blue', under_renovation: 'amber',
};

function FlatsInner() {
  const [rows, setRows] = useState<Flat[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Flat[] }>('/flats');
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Flats</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New flat</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <DataTable<Flat>
        rows={rows}
        columns={[
          { key: 'flat_number', header: 'Flat #' },
          { key: 'building',    header: 'Building', render: (r) => r.building?.name ?? '—' },
          { key: 'floor',       header: 'Floor', render: (r) => r.floor?.name ?? '—' },
          { key: 'bedrooms',    header: 'Beds' },
          { key: 'bathrooms',   header: 'Baths' },
          { key: 'base_rent',   header: 'Base rent', render: (r) => formatBDT(r.base_rent) },
          { key: 'status',      header: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.status.replace('_', ' ')}</Badge> },
        ]}
      />
      {open && <NewFlatDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewFlatDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [baseRent, setBaseRent] = useState('15000');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.get<{ data: Building[] }>('/buildings').then((r) => setBuildings(r.data ?? [])); }, []);
  useEffect(() => {
    if (!buildingId) return;
    api.get<{ floors?: Floor[] }>(`/buildings/${buildingId}`).then((b) => setFloors(b.floors ?? [])).catch(() => setFloors([]));
  }, [buildingId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      let fid = floorId;
      if (!fid && buildingId) {
        // auto-create level 0 floor if none exists
        const f = await api.post<Floor>('/floors', { building_id: parseInt(buildingId), name: 'Ground', level: 0 });
        fid = String(f.id);
      }
      await api.post('/flats', {
        building_id: parseInt(buildingId), floor_id: parseInt(fid),
        flat_number: flatNumber, bedrooms, bathrooms,
        base_rent: parseFloat(baseRent), has_balcony: true, has_kitchen: true,
      });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New flat</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Building</Label>
            <select required className="w-full rounded-md border px-3 py-2 text-sm" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
              <option value="">Select…</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Floor (auto-creates Ground if empty)</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={floorId} onChange={(e) => setFloorId(e.target.value)}>
              <option value="">Auto</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><Label>Flat number</Label><Input required value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} placeholder="1A" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Bedrooms</Label><Input type="number" value={bedrooms} onChange={(e) => setBedrooms(parseInt(e.target.value || '0'))} /></div>
            <div><Label>Bathrooms</Label><Input type="number" value={bathrooms} onChange={(e) => setBathrooms(parseInt(e.target.value || '0'))} /></div>
          </div>
          <div><Label>Base rent (BDT)</Label><Input type="number" step="0.01" value={baseRent} onChange={(e) => setBaseRent(e.target.value)} /></div>
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
