'use client';

import { AppShell } from '@/components/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Card } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppShell><SettingsInner /></AppShell>
    </AuthGuard>
  );
}

function SettingsInner() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card className="p-4">
        <h2 className="font-medium mb-3">Account</h2>
        <dl className="text-sm grid grid-cols-3 gap-y-2">
          <dt className="text-gray-500">Name</dt><dd className="col-span-2">{user.name}</dd>
          <dt className="text-gray-500">Email</dt><dd className="col-span-2">{user.email}</dd>
          <dt className="text-gray-500">Phone</dt><dd className="col-span-2">{user.phone}</dd>
          <dt className="text-gray-500">Role</dt><dd className="col-span-2 capitalize">{user.role}</dd>
        </dl>
      </Card>
      <Card className="p-4 text-sm text-gray-600">
        More settings (notification preferences, FCM device, language toggle) will appear in Phase 4.
      </Card>
    </div>
  );
}
