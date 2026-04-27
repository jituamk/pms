/* PMS Service Worker — offline shell + offline action queue
 * The action queue uses IndexedDB ("pms-offline" -> store "queue").
 * On reconnect, queued POST/PUT/PATCH requests are replayed.
 */

const CACHE_NAME = 'pms-shell-v1';
const SHELL = ['/', '/offline', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ------- IndexedDB helpers ------- */
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pms-offline', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function enqueue(reqClone) {
  const db = await openQueueDB();
  const body = await reqClone.text();
  const headers = {};
  reqClone.headers.forEach((v, k) => { headers[k] = v; });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({
      url: reqClone.url, method: reqClone.method, headers, body, queued_at: Date.now(),
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db = await openQueueDB();
  const all = await new Promise((res, rej) => {
    const tx = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
  for (const item of all) {
    try {
      const r = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body, credentials: 'include' });
      if (r.ok || r.status < 500) {
        await new Promise((res) => {
          const tx = db.transaction('queue', 'readwrite');
          tx.objectStore('queue').delete(item.id);
          tx.oncomplete = res;
        });
      }
    } catch (_) { /* still offline; abort */ break; }
  }
}

/* ------- Fetch handler ------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for API, with offline queue for mutations
  if (url.pathname.startsWith('/api/')) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      event.respondWith(
        fetch(req.clone()).catch(async () => {
          await enqueue(req.clone());
          return new Response(
            JSON.stringify({ queued: true, message: 'Saved offline. Will sync when online.' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        })
      );
      return;
    }
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first for static
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => caches.match('/offline')))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'pms-flush-queue') event.waitUntil(flushQueue());
});

self.addEventListener('online', () => flushQueue());

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FLUSH_QUEUE') flushQueue();
});
