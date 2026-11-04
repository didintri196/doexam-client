// Pictures of the attempt are downloaded when it starts, so they stay visible if the
// network drops (09-FRONTEND §5.4). The service worker serves /api/v1/media/* from this
// cache by path: signed links change every hour, the file behind an id never does.
export const MEDIA_CACHE = 'doexam-media-v1';
const CONCURRENCY = 4;

export function mediaCacheKey(url: string): string {
  return new URL(url, location.origin).pathname;
}

export interface MediaProgress {
  total: number;
  ready: number;
  failed: number;
}

/** prefetchMedia downloads every url not cached yet; onProgress reports each step. */
export async function prefetchMedia(urls: string[], onProgress: (p: MediaProgress) => void): Promise<MediaProgress> {
  const p: MediaProgress = { total: urls.length, ready: 0, failed: 0 };
  if (!urls.length) return p;
  if (!('caches' in window)) {
    // no Cache Storage (old browser / insecure origin): images load from the network as usual
    p.ready = p.total;
    onProgress({ ...p });
    return p;
  }
  onProgress({ ...p });
  let cache: Cache;
  try {
    cache = await caches.open(MEDIA_CACHE);
  } catch {
    p.ready = p.total;
    onProgress({ ...p });
    return p;
  }
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const key = mediaCacheKey(url);
      try {
        if (!(await cache.match(key))) {
          const res = await fetch(url, { credentials: 'omit' });
          if (!res.ok) throw new Error(String(res.status));
          await cache.put(key, res);
        }
        p.ready++;
      } catch {
        p.failed++;
      }
      onProgress({ ...p });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return p;
}

/** clearMediaCache drops the downloaded pictures once the attempt is over (shared lab PCs). */
export async function clearMediaCache(): Promise<void> {
  if ('caches' in window) await caches.delete(MEDIA_CACHE).catch(() => false);
}
