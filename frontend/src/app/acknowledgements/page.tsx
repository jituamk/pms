'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Badge, Card } from '@/components/ui';
import { api } from '@/lib/api';

interface Ack {
  id: number;
  status: 'pending' | 'partial' | 'acknowledged' | 'disputed';
  issued_at: string;
  acknowledged_at: string | null;
  lease?: { id: number; flat?: { flat_number: string; building?: { name: string } } };
  tenant?: { full_name: string };
  items?: { id: number }[];
}

const TONE: Record<Ack['status'], 'amber' | 'blue' | 'green' | 'red'> = {
  pending: 'amber', partial: 'blue', acknowledged: 'green', disputed: 'red',
};

export default function AckIndex() {
  return (
    <AuthGuard allowed={['owner', 'delegate', 'tenant']}>
      <AppShell><Inner /></AppShell>
    </AuthGuard>
  );
}

function Inner() {
  const [rows, setRows] = useState<Ack[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<Ack[]>('/acknowledgements')
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck size={22} /> Asset acknowledgements
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          When a lease activates, the tenant reviews and acknowledges every asset in the flat.
        </p>
      </div>
      {err && <Card className="p-3 text-red-600 text-sm">{err}</Card>}
      <div className="grid gap-2">
        {rows.map((a) => (
          <Link
            key={a.id}
            href={`/acknowledgements/${a.id}`}
            className="block rounded-lg border bg-white p-4 hover:border-brand-500 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {a.lease?.flat?.building?.name ?? 'Building'} · Flat {a.lease?.flat?.flat_number ?? '—'}
                </div>
                <div className="text-xs text-gray-500">
                  Tenant: {a.tenant?.full_name ?? '—'} · Issued {new Date(a.issued_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={TONE[a.status]}>{a.status}</Badge>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 && !err && (
          <Card className="p-6 text-sm text-gray-500 text-center">No acknowledgements yet.</Card>
        )}
      </div>
    </div>
  );
}
