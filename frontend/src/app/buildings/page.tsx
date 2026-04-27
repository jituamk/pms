'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';

interface Building { id: number; name: string; address: string; area: string | null; status: string; flats_count?: number; floors_count?: number }

export default function BuildingsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell><BuildingsInner /></AppShell>
    </AuthGuard>
  );
}

function BuildingsInner() {
  const [rows, setRows] = useState<Building[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Building[] }>('/buildings');
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Buildings</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New building</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <DataTable<Building>
        rows={rows}
        columns={[
          { key: 'name', header: 'Name', render: (r) => <Link href={`/buildings/${r.id}`} className="text-brand-700 hover:underline">{r.name}</Link> },
          { key: 'address', header: 'Address' },
          { key: 'area',    header: 'Area', render: (r) => r.area ?? '—' },
          { key: 'flats_count', header: 'Flats', render: (r) => r.flats_count ?? 0 },
          { key: 'status',  header: 'Status', className: 'capitalize' },
        ]}
      />
      {open && <NewBuildingDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewBuildingDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [floors, setFloors] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/buildings', { name, address, area, total_floors: floors });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New building</h2>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Address</Label><Input required value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>Area (Dhanmondi, Gulshan…)</Label><Input value={area} onChange={(e) => setArea(e.target.value)} /></div>
          <div><Label>Total floors</Label><Input type="number" min={1} value={floors} onChange={(e) => setFloors(parseInt(e.target.value || '1'))} /></div>
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
