'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Card } from '@/components/ui';
import { api } from '@/lib/api';

interface Flat {
  id: number;
  flat_number: string;
  status: string;
  building?: { id: number; name: string };
  floor?: { name: string };
}

export default function AssetsIndex() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'accountant']}>
      <AppShell>
        <Inner />
      </AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const [rows, setRows] = useState<Flat[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Flat[] }>('/flats')
      .then((r) => setRows(r.data ?? []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package size={22} /> Asset inventory
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick a flat to manage its room-level assets. Each room can hold furniture,
          electronics, fixtures, kitchen, and other items.
        </p>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <div className="grid gap-2">
        {rows.map((f) => (
          <Link
            key={f.id}
            href={`/assets/${f.id}`}
            className="block rounded-lg border bg-white p-4 hover:border-brand-500 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {f.building?.name ?? 'Building'} · Flat {f.flat_number}
                </div>
                <div className="text-xs text-gray-500">{f.floor?.name ?? ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={f.status === 'occupied' ? 'green' : 'gray'}>
                  {f.status.replace('_', ' ')}
                </Badge>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 && !err && (
          <Card className="p-6 text-sm text-gray-500 text-center">
            No flats yet. Create flats first under Buildings → Flats.
          </Card>
        )}
      </div>
    </div>
  );
}
