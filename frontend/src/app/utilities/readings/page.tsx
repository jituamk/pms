'use client';

import { useEffect, useState } from 'react';
import { Plus, Camera } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/money';

interface Building { id: number; name: string }
interface Flat { id: number; flat_number: string; building_id: number }
interface Rate { id: number; utility_type: string; label: string | null; rate_per_unit: string; allocation: string }
interface Meter {
  id: number; meter_number: string | null; opening_reading: string;
  flat?: Flat; rate?: Rate;
}
interface Reading {
  id: number; reading_month: string; previous_reading: string; current_reading: string;
  units_consumed: string; reading_date: string; photo_path: string | null;
  meter?: Meter; recorder?: { name: string };
}

export default function ReadingsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant', 'caretaker', 'super_admin']}>
      <AppShell><ReadingsInner /></AppShell>
    </AuthGuard>
  );
}

function ReadingsInner() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filterBuilding, setFilterBuilding] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const qs = filterBuilding ? `?building_id=${filterBuilding}` : '';
    const [r, b] = await Promise.all([
      api.get<{ data: Reading[] }>(`/utility-readings${qs}`),
      api.get<{ data: Building[] }>('/buildings'),
    ]);
    setReadings(r.data ?? []);
    setBuildings(b.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [filterBuilding]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meter readings</h1>
          <p className="text-sm text-gray-500">Capture monthly readings with a photo proof.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Record reading</Button>
      </div>

      <Card className="p-3">
        <div className="flex items-end gap-3">
          <div>
            <Label>Filter by building</Label>
            <select className="rounded-md border px-3 py-2 text-sm min-w-48" value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
              <option value="">All buildings</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      <DataTable<Reading>
        rows={readings}
        empty="No readings yet."
        columns={[
          { key: 'month', header: 'Month', render: (r) => formatDate(r.reading_month) },
          { key: 'flat', header: 'Flat', render: (r) => r.meter?.flat?.flat_number ?? '—' },
          { key: 'utility', header: 'Utility', render: (r) => <span className="capitalize">{r.meter?.rate?.utility_type?.replace('_', ' ')}</span> },
          { key: 'previous', header: 'Previous', render: (r) => r.previous_reading },
          { key: 'current', header: 'Current', render: (r) => r.current_reading },
          { key: 'units', header: 'Units', render: (r) => <Badge tone="blue">{r.units_consumed}</Badge> },
          { key: 'date', header: 'Read on', render: (r) => formatDate(r.reading_date) },
          { key: 'photo', header: 'Photo', render: (r) => r.photo_path ? <Camera size={16} className="text-green-600" /> : <span className="text-gray-400 text-xs">—</span> },
          { key: 'recorder', header: 'By', render: (r) => r.recorder?.name ?? '—' },
        ]}
      />

      {open && (
        <NewReadingDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />
      )}
    </div>
  );
}

function NewReadingDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [meterId, setMeterId] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + '-01');
  const [current, setCurrent] = useState('');
  const [readingDate, setReadingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<Meter[]>('/utility-meters').then((m) => {
      const list = Array.isArray(m) ? m : [];
      setMeters(list);
      if (list[0]) setMeterId(String(list[0].id));
    }).catch((e) => setErr(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('utility_meter_id', meterId);
      fd.append('reading_month', month);
      fd.append('current_reading', current);
      fd.append('reading_date', readingDate);
      if (notes) fd.append('notes', notes);
      if (photo) fd.append('photo', photo);
      await api.post('/utility-readings', fd);
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  const selected = meters.find((m) => String(m.id) === meterId);

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Record meter reading</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Meter</Label>
            <select required className="w-full rounded-md border px-3 py-2 text-sm" value={meterId} onChange={(e) => setMeterId(e.target.value)}>
              <option value="">Select…</option>
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.flat?.flat_number ?? '?'} · {m.rate?.utility_type ?? ''}{m.meter_number ? ` (#${m.meter_number})` : ''}
                </option>
              ))}
            </select>
            {selected && <p className="text-xs text-gray-500 mt-1">Opening: {selected.opening_reading}</p>}
          </div>
          <div><Label>Month (1st of)</Label><Input type="date" required value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div><Label>Current reading</Label><Input type="number" step="0.01" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><Label>Reading date</Label><Input type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} /></div>
          <div>
            <Label>Photo of meter</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

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
