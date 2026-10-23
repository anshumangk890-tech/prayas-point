const cacheName = (userId: string) => `exam-downloads-v1-${userId}`;
const cacheKey = (id: string) => new URL(`/offline/document/${encodeURIComponent(id)}`, window.location.origin).toString();

export async function listOfflineDocuments(userId: string): Promise<string[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(cacheName(userId));
  return (await cache.keys()).map((request) => decodeURIComponent(new URL(request.url).pathname.split("/").at(-1) || ""));
}

export async function saveOfflineDocument(userId: string, id: string, onProgress: (percent: number) => void) {
  if (!("caches" in window)) throw new Error("Offline downloads are not supported in this browser.");
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}/file?download=1`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "Could not download this PDF."); }
  const length = Number(response.headers.get("Content-Length") || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Download stream unavailable. Please try another browser.");
  const chunks: Uint8Array[] = []; let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); received += value.byteLength;
    if (length) onProgress(Math.min(99, Math.round(received / length * 100)));
  }
  const blob = new Blob(chunks.map((part) => new Uint8Array(part)), { type: "application/pdf" });
  const cache = await caches.open(cacheName(userId));
  await cache.put(cacheKey(id), new Response(blob, { headers: { "Content-Type": "application/pdf" } }));
  onProgress(100);
}

export async function offlineDocumentUrl(userId: string, id: string): Promise<string | null> {
  if (!("caches" in window)) return null;
  const cache = await caches.open(cacheName(userId));
  const response = await cache.match(cacheKey(id));
  return response ? URL.createObjectURL(await response.blob()) : null;
}

export async function removeOfflineDocument(userId: string, id: string) {
  if (!("caches" in window)) return;
  const cache = await caches.open(cacheName(userId));
  await cache.delete(cacheKey(id));
}

export async function clearOfflineDocuments(userId: string) {
  if ("caches" in window) await caches.delete(cacheName(userId));
}

export function clearLocalAttemptDrafts() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith("exam-draft-")) localStorage.removeItem(key);
    }
  } catch { /* Private browsing may disable device storage. */ }
}
