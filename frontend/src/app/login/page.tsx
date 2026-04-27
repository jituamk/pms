'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(identifier, password);
      router.replace('/dashboard');
    } catch (err) {
      setError((err as { message: string }).message ?? 'Login failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-brand-50 to-white">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="size-12 mx-auto rounded-xl bg-brand-500 text-white grid place-items-center font-bold text-xl">P</div>
          <h1 className="text-2xl font-semibold mt-3">Sign in to PMS</h1>
          <p className="text-sm text-gray-500">Property management for Dhaka</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="identifier">Email or phone</Label>
            <Input id="identifier" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="owner@pms.test or +8801711000000" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <div className="mt-6 flex justify-between text-sm">
          <Link href="/signup" className="text-brand-700 hover:underline">Owner sign up</Link>
          <Link href="/forgot" className="text-gray-500 hover:underline">Forgot password?</Link>
        </div>
      </Card>
    </div>
  );
}
