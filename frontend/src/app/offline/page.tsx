export default function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-2">You&apos;re offline</h1>
        <p className="text-gray-600">No internet connection. Any actions you take will be queued and synced automatically once you&apos;re back online.</p>
      </div>
    </div>
  );
}
