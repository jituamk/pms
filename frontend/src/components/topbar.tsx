'use client';

import { LogOut, Bell, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';

export function Topbar() {
  const { user, logout } = useAuth();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Welcome, <strong className="text-gray-900">{user?.name}</strong></span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{user?.role}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={online ? 'text-green-600' : 'text-amber-600'} title={online ? 'Online' : 'Offline — actions queued'}>
          {online ? <Wifi size={18} /> : <WifiOff size={18} />}
        </span>
        <button className="text-gray-500 hover:text-gray-800"><Bell size={18} /></button>
        <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-700 hover:text-red-600">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}
