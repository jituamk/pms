'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, Plus, Trash2, Lock } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';

interface InspectionItem {
  id: number;
  inspection_id: number;
  room_asset_id: number;
  room_id: number;
  asset_name_snapshot: string;
  move_in_condition: string | null;
  exit_condition: 'good' | 'fair' | 'poor' | 'damaged' | 'missing';
  is_damaged: boolean;
  damage_charge: string;
  inspector_note: string | null;
  category?: { label: string };
  room?: { name: string };
}
interface Inspection {
  id: number;
  status: 'draft' | 'finalized';
  total_damage_charge: string;
  deposit_amount: string;
  deposit_refund: string;
  summary_notes: string | null;
  items: InspectionItem[];
  lease?: { id: number; flat?: { flat_number: string; building?: { name: string } }; tenant?: { full_name: string } };
}
interface ExtraDeduction {
  reason: 'cleaning' | 'unpaid_rent' | 'utilities' | 'other';
  amount: string;
  description: string;
}

const COND_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  good: 'green', fair: 'amber', poor: 'red', damaged: 'red', missing: 'red',
};

export default function InspectionDetail() {
  return (
    <AuthGuard allowed={['owner', 'delegate']}>
      <AppShell><Inner /></AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [extras, setExtras] = useState<ExtraDeduction[]>([]);
  const [summary, setSummary] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  async function load() {
    try {
      const i = await api.get<Inspection>(`/inspections/${id}`);
      setInsp(i);
      setSummary(i.summary_notes ?? '');
    } catch (e) {
      setErr((e as { message: string }).message);
    }
  }
  useEffect(() => { load(); }, [id]);

  const grouped = useMemo(() => {
    if (!insp) return {} as Record<string, InspectionItem[]>;
    return insp.items.reduce<Record<string, InspectionItem[]>>((acc, it) => {
      const key = it.room?.name ?? `Room ${it.room_id}`;
      (acc[key] = acc[key] ?? []).push(it);
      return acc;
    }, {});
  }, [insp]);

  const extrasTotal = extras.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const damageTotal = parseFloat(insp?.total_damage_charge ?? '0');
  const totalCharge = damageTotal + extrasTotal;
  const deposit     = parseFloat(insp?.deposit_amount ?? '0');
  const refund      = Math.max(0, deposit - totalCharge);

  async function updateItem(item: InspectionItem, patch: Partial<InspectionItem>) {
    try {
      const data = {
        exit_condition: patch.exit_condition ?? item.exit_condition,
        is_damaged: patch.is_damaged ?? item.is_damaged,
        damage_charge: parseFloat(String(patch.damage_charge ?? item.damage_charge)) || 0,
        inspector_note: patch.inspector_note ?? item.inspector_note,
      };
      await api.patch(`/inspection-items/${item.id}`, data);
      load();
    } catch (e) {
      setErr((e as { message: string }).message);
    }
  }

  async function finalize() {
    if (!insp) return;
    if (!confirm('Finalize this inspection? Deposit deductions will be locked.')) return;
    setFinalizing(true); setErr(null);
    try {
      await api.post(`/inspections/${insp.id}/finalize`, {
        summary_notes: summary,
        extra_deductions: extras.filter((e) => parseFloat(e.amount) > 0).map((e) => ({
          reason: e.reason,
          amount: parseFloat(e.amount),
          description: e.description || null,
        })),
      });
      router.push('/inspections');
    } catch (e) {
      setErr((e as { message: string }).message);
      setFinalizing(false);
    }
  }

  if (!insp) return <Card className="p-4">{err ?? 'Loading…'}</Card>;
  const locked = insp.status === 'finalized';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Search size={22} /> Move-out inspection
          </h1>
          <div className="text-sm text-gray-500">
            {insp.lease?.flat?.building?.name} · Flat {insp.lease?.flat?.flat_number} · {insp.lease?.tenant?.full_name}
          </div>
        </div>
        <Badge tone={locked ? 'green' : 'amber'}>{insp.status}</Badge>
      </div>

      <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
        <div><div className="text-xs text-gray-500">Deposit held</div><div className="text-xl font-semibold">{formatBDT(deposit)}</div></div>
        <div><div className="text-xs text-gray-500">Asset damage</div><div className="text-xl font-semibold text-red-600">{formatBDT(damageTotal)}</div></div>
        <div><div className="text-xs text-gray-500">Extra deductions</div><div className="text-xl font-semibold text-red-600">{formatBDT(extrasTotal)}</div></div>
        <div><div className="text-xs text-gray-500">Refund to tenant</div><div className="text-xl font-semibold text-green-700">{formatBDT(refund)}</div></div>
      </Card>

      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      {Object.entries(grouped).map(([roomName, items]) => (
        <Card key={roomName} className="p-4">
          <div className="font-semibold mb-3">{roomName}</div>
          <div className="space-y-2">
            {items.map((it) => (
              <ItemRow key={it.id} item={it} disabled={locked} onChange={(patch) => updateItem(it, patch)} />
            ))}
          </div>
        </Card>
      ))}

      {!locked && (
        <Card className="p-4 space-y-3">
          <div className="font-semibold">Extra deductions</div>
          {extras.map((e, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-3">
                <Label>Reason</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={e.reason}
                  onChange={(ev) => setExtras(extras.map((x, i) => i === idx ? { ...x, reason: ev.target.value as ExtraDeduction['reason'] } : x))}
                >
                  <option value="cleaning">Cleaning</option>
                  <option value="unpaid_rent">Unpaid rent</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <Label>Amount (BDT)</Label>
                <Input type="number" step="0.01" value={e.amount} onChange={(ev) => setExtras(extras.map((x, i) => i === idx ? { ...x, amount: ev.target.value } : x))} />
              </div>
              <div className="sm:col-span-5">
                <Label>Description</Label>
                <Input value={e.description} onChange={(ev) => setExtras(extras.map((x, i) => i === idx ? { ...x, description: ev.target.value } : x))} />
              </div>
              <button onClick={() => setExtras(extras.filter((_, i) => i !== idx))} className="sm:col-span-1 p-2 rounded hover:bg-red-50 text-red-600 self-end">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setExtras([...extras, { reason: 'cleaning', amount: '0', description: '' }])}>
            <Plus size={14} /> Add deduction
          </Button>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <Label>Summary notes</Label>
        <textarea
          disabled={locked}
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        {!locked && (
          <div className="flex justify-end">
            <Button onClick={finalize} disabled={finalizing}>
              <Lock size={14} /> {finalizing ? 'Finalizing…' : 'Finalize inspection'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function ItemRow({
  item, disabled, onChange,
}: {
  item: InspectionItem;
  disabled: boolean;
  onChange: (patch: Partial<InspectionItem>) => void;
}) {
  const [exitCond, setExitCond] = useState(item.exit_condition);
  const [charge, setCharge]     = useState(item.damage_charge);
  const [note, setNote]         = useState(item.inspector_note ?? '');

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{item.asset_name_snapshot}</span>
            <Badge tone="gray">{item.category?.label ?? '—'}</Badge>
            <span className="text-xs text-gray-500">Move-in: {item.move_in_condition ?? '—'}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-2 mt-2">
            <select
              disabled={disabled}
              className="rounded-md border px-3 py-1.5 text-sm"
              value={exitCond}
              onChange={(e) => {
                const v = e.target.value as InspectionItem['exit_condition'];
                setExitCond(v);
                onChange({ exit_condition: v, is_damaged: ['damaged', 'missing', 'poor'].includes(v) });
              }}
            >
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="damaged">Damaged</option>
              <option value="missing">Missing</option>
            </select>
            <Input
              type="number" step="0.01" disabled={disabled}
              placeholder="Damage charge (BDT)"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
              onBlur={() => onChange({ damage_charge: charge })}
            />
            <Input
              disabled={disabled}
              placeholder="Inspector note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => onChange({ inspector_note: note })}
            />
          </div>
        </div>
        <Badge tone={COND_TONE[exitCond]}>{exitCond}</Badge>
      </div>
    </div>
  );
}
