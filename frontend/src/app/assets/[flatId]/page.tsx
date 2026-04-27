'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/money';
import { useAuth } from '@/lib/auth-context';

interface AssetCategory { id: number; key: string; label: string; icon: string | null }
interface Room { id: number; name: string; type: string }
interface RoomAsset {
  id: number;
  room_id: number;
  flat_id: number;
  asset_category_id: number;
  name: string;
  brand: string | null;
  model_no: string | null;
  serial_no: string | null;
  quantity: number;
  condition: 'new' | 'good' | 'fair' | 'poor';
  purchase_price: string | null;
  purchased_on: string | null;
  notes: string | null;
  active: boolean;
  category?: AssetCategory;
}
interface Flat {
  id: number;
  flat_number: string;
  building?: { id: number; name: string };
  rooms?: Room[];
}

const COND_TONE: Record<string, 'green' | 'amber' | 'gray' | 'red'> = {
  new: 'green', good: 'green', fair: 'amber', poor: 'red',
};

export default function FlatAssetsPage() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell><Inner /></AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const { flatId } = useParams<{ flatId: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'delegate' || user?.role === 'super_admin';

  const [flat, setFlat] = useState<Flat | null>(null);
  const [assets, setAssets] = useState<RoomAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [editing, setEditing] = useState<{ asset: RoomAsset | null; roomId: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const [f, a, c] = await Promise.all([
        api.get<Flat>(`/flats/${flatId}`),
        api.get<RoomAsset[]>(`/flats/${flatId}/assets`),
        api.get<AssetCategory[]>('/asset-categories'),
      ]);
      setFlat(f);
      setAssets(a);
      setCategories(c);
    } catch (e) {
      setErr((e as { message: string }).message);
    }
  }
  useEffect(() => { load(); }, [flatId]);

  async function remove(id: number) {
    if (!confirm('Remove this asset?')) return;
    await api.delete(`/assets/${id}`);
    load();
  }

  if (!flat) return <Card className="p-4">{err ?? 'Loading…'}</Card>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package size={22} /> {flat.building?.name} · Flat {flat.flat_number}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assets per room. The tenant assigned to this flat will acknowledge these on lease activation.
        </p>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}

      {(flat.rooms ?? []).map((room) => {
        const roomAssets = assets.filter((a) => a.room_id === room.id);
        return (
          <Card key={room.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">{room.name}</div>
                <div className="text-xs text-gray-500 capitalize">{room.type}</div>
              </div>
              {canEdit && (
                <Button onClick={() => setEditing({ asset: null, roomId: room.id })} variant="secondary">
                  <Plus size={14} /> Add asset
                </Button>
              )}
            </div>
            {roomAssets.length === 0 ? (
              <div className="text-sm text-gray-500 italic">No assets yet.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {roomAssets.map((a) => (
                  <div key={a.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{a.name}</span>
                        <Badge tone="gray">{a.category?.label ?? '—'}</Badge>
                        <Badge tone={COND_TONE[a.condition]}>{a.condition}</Badge>
                        {a.quantity > 1 && <Badge tone="blue">×{a.quantity}</Badge>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {[a.brand, a.model_no].filter(Boolean).join(' · ')}
                        {a.purchase_price && <> · {formatBDT(a.purchase_price)}</>}
                      </div>
                      {a.notes && <div className="text-xs text-gray-600 mt-1">{a.notes}</div>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-gray-100"
                          onClick={() => setEditing({ asset: a, roomId: room.id })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-red-50 text-red-600"
                          onClick={() => remove(a.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {editing && (
        <AssetDialog
          flatId={parseInt(flatId)}
          roomId={editing.roomId}
          asset={editing.asset}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function AssetDialog({
  flatId, roomId, asset, categories, onClose, onSaved,
}: {
  flatId: number;
  roomId: number;
  asset: RoomAsset | null;
  categories: AssetCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(String(asset?.asset_category_id ?? categories[0]?.id ?? ''));
  const [name, setName] = useState(asset?.name ?? '');
  const [brand, setBrand] = useState(asset?.brand ?? '');
  const [modelNo, setModelNo] = useState(asset?.model_no ?? '');
  const [serial, setSerial] = useState(asset?.serial_no ?? '');
  const [quantity, setQuantity] = useState(asset?.quantity ?? 1);
  const [condition, setCondition] = useState<RoomAsset['condition']>(asset?.condition ?? 'good');
  const [price, setPrice] = useState(asset?.purchase_price ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const payload = {
        asset_category_id: parseInt(categoryId),
        name,
        brand: brand || null,
        model_no: modelNo || null,
        serial_no: serial || null,
        quantity,
        condition,
        purchase_price: price ? parseFloat(price) : null,
        notes: notes || null,
      };
      if (asset) {
        await api.patch(`/assets/${asset.id}`, payload);
      } else {
        await api.post(`/rooms/${roomId}/assets`, payload);
      }
      onSaved();
    } catch (e) {
      setErr((e as { message: string }).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{asset ? 'Edit asset' : 'New asset'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Category</Label>
            <select
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Almirah, Split AC, etc." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
            <div><Label>Model</Label><Input value={modelNo} onChange={(e) => setModelNo(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Serial #</Label><Input value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
            <div><Label>Quantity</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value || '1'))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Condition</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={condition}
                onChange={(e) => setCondition(e.target.value as RoomAsset['condition'])}
              >
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <Label>Price (BDT)</Label>
              <Input type="number" step="0.01" value={price ?? ''} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
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
