'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button, Card, Input, Label } from '@/components/ui';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [pwd, setPwd]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [info, setInfo]     = useState<string | null>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api.post('/auth/password/request-otp', { phone });
      setStep(2);
      setInfo('OTP sent. Check your SMS.');
    } catch (err) {
      setError((err as { message: string }).message);
    } finally { setBusy(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) { setError('Passwords do not match'); return; }
    setError(null); setBusy(true);
    try {
      await api.post('/auth/password/reset', { phone, otp, password: pwd, password_confirmation: confirm });
      router.replace('/login');
    } catch (err) {
      setError((err as { message: string }).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-brand-50 to-white">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold mb-4">Reset password</h1>
        {info && <div className="text-sm text-green-700 mb-3">{info}</div>}
        {step === 1 ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <Label>Registered phone</Label>
              <Input required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</Button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-4">
            <div>
              <Label>OTP</Label>
              <Input required value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <div>
              <Label>New password</Label>
              <Input required type="password" minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input required type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</Button>
          </form>
        )}
        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-gray-500 hover:underline">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}
