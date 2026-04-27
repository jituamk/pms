'use client';

import { useEffect, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Button, Card, Input, Label } from '@/components/ui';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';

interface Tenant { id: number; full_name: string; phone: string; email: string | null; nid_number: string | null; family_members_count: number; active_lease?: { flat?: { flat_number: string } } | null }

export default function TenantsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell><TenantsInner /></AppShell>
    </AuthGuard>
  );
}

function TenantsInner() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Tenant[] }>('/tenants');
    setRows(r.data ?? []);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function invite(t: Tenant) {
    setErr(null); setInfo(null);
    try {
      await api.post('/tenants/invite', { tenant_id: t.id });
      setInfo(`Invitation SMS sent to ${t.phone}.`);
    } catch (e) { setErr((e as { message: string }).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> New tenant</Button>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      {info && <Card className="p-3 text-green-700 text-sm">{info}</Card>}
      <DataTable<Tenant>
        rows={rows}
        columns={[
          { key: 'full_name', header: 'Name' },
          { key: 'phone',     header: 'Phone' },
          { key: 'flat',      header: 'Flat', render: (r) => r.active_lease?.flat?.flat_number ?? '—' },
          { key: 'family_members_count', header: 'Family' },
          { key: 'actions', header: '', render: (r) => (
            <Button variant="secondary" onClick={() => invite(r)}><Send size={14} /> Invite</Button>
          ) },
        ]}
      />
      {open && <NewTenantDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function NewTenantDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nid, setNid] = useState('');
  const [family, setFamily] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post('/tenants', { full_name: name, phone, email: email || null, nid_number: nid || null, family_members_count: family });
      onSaved();
    } catch (e) { setErr((e as { message: string }).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New tenant</h2>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" /></div>
          <div><Label>Email (optional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>NID</Label><Input value={nid} onChange={(e) => setNid(e.target.value)} /></div>
          <div><Label>Family members</Label><Input type="number" min={1} value={family} onChange={(e) => setFamily(parseInt(e.target.value || '1'))} /></div>
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
