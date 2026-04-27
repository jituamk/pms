'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Input, Label } from '@/components/ui';

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState('');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [nidImage, setNidImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api.post('/auth/signup/request-otp', { phone });
      setStep(2);
    } catch (err) {
      setError((err as { message: string }).message);
    } finally { setBusy(false); }
  }

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!nidImage) { setError('Please upload your National ID image'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('phone', phone);
      fd.append('otp', otp);
      fd.append('name', name);
      fd.append('email', email);
      fd.append('password', password);
      fd.append('password_confirmation', confirm);
      fd.append('nid_number', nidNumber);
      fd.append('nid_image', nidImage);
      const res = await api.post<{ token: string }>('/auth/signup/verify', fd);
      setToken(res.token);
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError((err as { message: string }).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-brand-50 to-white">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold mb-1">Owner Sign Up</h1>
        <p className="text-sm text-gray-500 mb-6">Step {step} of 2 — {step === 1 ? 'Verify your phone' : 'Complete your profile'}</p>

        {step === 1 ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <Label>Phone (Bangladesh)</Label>
              <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending OTP…' : 'Send OTP'}</Button>
          </form>
        ) : (
          <form onSubmit={completeSignup} className="space-y-4">
            <div>
              <Label>OTP (sent to {phone})</Label>
              <Input required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full name</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Password</Label>
                <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input required type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>National ID number</Label>
              <Input required value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} />
            </div>
            <div>
              <Label>National ID image</Label>
              <Input required type="file" accept="image/*,.pdf" onChange={(e) => setNidImage(e.target.files?.[0] ?? null)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          Already have an account? <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
