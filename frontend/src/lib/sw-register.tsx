'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    const flush = () => navigator.serviceWorker.controller?.postMessage({ type: 'FLUSH_QUEUE' });
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
  return null;
}
