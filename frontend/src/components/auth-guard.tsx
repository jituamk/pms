'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type Role } from '@/lib/auth-context';

export function AuthGuard({ allowed, children }: { allowed?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (allowed && !allowed.includes(user.role)) router.replace('/dashboard');
  }, [loading, user, allowed, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
