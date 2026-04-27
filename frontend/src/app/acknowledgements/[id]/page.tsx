'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Check, X, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface AckItem {
  id: number;
  acknowledgement_id: number;
  room_asset_id: number;
  room_id: number;
  asset_category_id: number;
  asset_name_snapshot: string;
  quantity_snapshot: number;
  owner_condition_snapshot: 'new' | 'good' | 'fair' | 'poor';
  is_present: boolean | null;
  tenant_condition: string | null;
  tenant_note: string | null;
  category?: { label: string };
  room?: { name: string };
}
interface Ack {
  id: number;
  status: 'pending' | 'partial' | 'acknowledged' | 'disputed';
  issued_at: string;
  acknowledged_at: string | null;
  tenant_notes: string | null;
  items: AckItem[];
  lease?: { id: number; flat?: { flat_number: string; building?: { name: string } } };
  tenant?: { full_name: string };
}

const STATUS_TONE: Record<Ack['status'], 'amber' | 'blue' | 'green' | 'red'> = {
  pending: 'amber', partial: 'blue', acknowledged: 'green', disputed: 'red',
};

export default function AckDetail() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'tenant']}>
      <AppShell><Inner /></AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isTenant = user?.role === 'tenant';

  const [ack, setAck] = useState<Ack | null>(null);
  const [tenantNotes, setTenantNotes] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const a = await api.get<Ack>(`/acknowledgements/${id}`);
      setAck(a);
      setTenantNotes(a.tenant_notes ?? '');
    } catch (e) {
      setErr((e as { message: string }).message);
    }
  }
  useEffect(() => { load(); }, [id]);

  const grouped = useMemo(() => {
    if (!ack) return {} as Record<string, AckItem[]>;
    return ack.items.reduce<Record<string, AckItem[]>>((acc, it) => {
      const key = it.room?.name ?? `Room ${it.room_id}`;
      (acc[key] = acc[key] ?? []).push(it);
      return acc;
    }, {});
  }, [ack]);

  async function tickItem(item: AckItem, isPresent: boolean, tenantCondition: string | null, note: string | null) {
    if (!isTenant) return;
    setBusy(item.id);
    try {
      await api.patch(`/acknowledgement-items/${item.id}`, {
        is_present: isPresent,
        tenant_condition: tenantCondition,
        tenant_note: note,
      });
      load();
    } catch (e) {
      setErr((e as { message: string }).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!ack) return;
    setSubmitting(true); setErr(null);
    try {
      await api.post(`/acknowledgements/${ack.id}/submit`, { tenant_notes: tenantNotes });
      router.push('/acknowledgements');
    } catch (e) {
      setErr((e as { message: string }).message);
      setSubmitting(false);
    }
  }

  if (!ack) return <Card className="p-4">{err ?? 'Loading…'}</Card>;

  const total   = ack.items.length;
  const ticked  = ack.items.filter((i) => i.is_present !== null).length;
  const issues  = ack.items.filter((i) => i.tenant_condition === 'damaged' || i.tenant_condition === 'missing').length;
  const allDone = ticked === total;
  const locked  = ack.status === 'acknowledged';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck size={22} /> Asset acknowledgement
          </h1>
          <div className="text-sm text-gray-500">
            {ack.lease?.flat?.building?.name} · Flat {ack.lease?.flat?.flat_number} · {ack.tenant?.full_name}
          </div>
        </div>
        <Badge tone={STATUS_TONE[ack.status]}>{ack.status}</Badge>
      </div>

      <Card className="p-3 grid grid-cols-3 gap-3 text-center text-sm">
        <div><div className="text-2xl font-semibold">{total}</div><div className="text-gray-500">Total</div></div>
        <div><div className="text-2xl font-semibold">{ticked}</div><div className="text-gray-500">Reviewed</div></div>
        <div><div className="text-2xl font-semibold text-amber-600">{issues}</div><div className="text-gray-500">Damaged / Missing</div></div>
      </Card>

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      {Object.entries(grouped).map(([roomName, items]) => (
        <Card key={roomName} className="p-4">
          <div className="font-semibold mb-3">{roomName}</div>
          <div className="space-y-2">
            {items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                disabled={!isTenant || locked || busy === it.id}
                onChange={(present, cond, note) => tickItem(it, present, cond, note)}
              />
            ))}
          </div>
        </Card>
      ))}

      {isTenant && !locked && (
        <Card className="p-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Additional notes (optional)</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm mt-1"
              rows={3}
              value={tenantNotes}
              onChange={(e) => setTenantNotes(e.target.value)}
              placeholder="Anything else the owner should know about the flat condition?"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {allDone ? 'All items reviewed. You can submit.' : `${total - ticked} item(s) not yet reviewed.`}
            </div>
            <Button onClick={submit} disabled={!allDone || submitting}>
              {submitting ? 'Submitting…' : 'Submit acknowledgement'}
            </Button>
          </div>
        </Card>
      )}

      {locked && (
        <Card className="p-3 text-sm text-green-700 bg-green-50 border-green-200 flex items-center gap-2">
          <Check size={16} /> Acknowledged on {new Date(ack.acknowledged_at!).toLocaleString()}
        </Card>
      )}
    </div>
  );
}

function ItemRow({
  item, disabled, onChange,
}: {
  item: AckItem;
  disabled: boolean;
  onChange: (isPresent: boolean, tenantCondition: string | null, note: string | null) => void;
}) {
  const [present, setPresent] = useState<boolean | null>(item.is_present);
  const [cond, setCond] = useState<string>(item.tenant_condition ?? item.owner_condition_snapshot);
  const [note, setNote] = useState(item.tenant_note ?? '');

  const tone =
    item.tenant_condition === 'damaged' || item.tenant_condition === 'missing' ? 'red'
    : item.is_present === true ? 'green'
    : item.is_present === false ? 'red'
    : 'gray';

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{item.asset_name_snapshot}</span>
            <Badge tone="gray">{item.category?.label ?? '—'}</Badge>
            {item.quantity_snapshot > 1 && <Badge tone="blue">×{item.quantity_snapshot}</Badge>}
            <span className="text-xs text-gray-500">Owner condition: {item.owner_condition_snapshot}</span>
          </div>
          <div className="mt-2 grid sm:grid-cols-3 gap-2">
            <div className="flex gap-2">
              <button
                disabled={disabled}
                onClick={() => { setPresent(true); onChange(true, cond, note || null); }}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${present === true ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white'}`}
              >
                <Check size={14} className="inline" /> Present
              </button>
              <button
                disabled={disabled}
                onClick={() => { setPresent(false); onChange(false, 'missing', note || null); }}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${present === false ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white'}`}
              >
                <X size={14} className="inline" /> Missing
              </button>
            </div>
            <select
              disabled={disabled || present === null}
              className="rounded-md border px-3 py-1.5 text-sm"
              value={cond}
              onChange={(e) => { setCond(e.target.value); onChange(present ?? true, e.target.value, note || null); }}
            >
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
              <option value="missing">Missing</option>
            </select>
            <input
              disabled={disabled}
              className="rounded-md border px-3 py-1.5 text-sm"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => present !== null && onChange(present, cond, note || null)}
            />
          </div>
        </div>
        <Badge tone={tone}>{item.is_present === null ? 'Not reviewed' : item.tenant_condition ?? (item.is_present ? 'present' : 'missing')}</Badge>
      </div>
      {item.tenant_condition === 'damaged' && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={12} /> Owner will review this during the next inspection.
        </div>
      )}
    </div>
  );
}
