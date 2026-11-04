import { useMemo, type ReactNode } from 'react';
import type { MediaRef } from '@/shared/api/types';
import { MediaContext, type MediaSource } from '@/shared/item/media';
import { mediaApi } from '../api';

const MAX_PER_REQUEST = 500;
// Links are valid ≥12 h; renew well before that while the panel stays open.
const TTL_MS = 6 * 60 * 60 * 1000;

/** PanelMediaSource asks the server for links on demand, batching ids from one render. */
class PanelMediaSource implements MediaSource {
  private refs = new Map<string, { ref: MediaRef; at: number }>();
  private asked = new Set<string>();
  private queue = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<() => void>();
  private v = 0;

  get = (id: string) => {
    const hit = this.refs.get(id);
    return hit && Date.now() - hit.at < TTL_MS ? hit.ref : undefined;
  };

  /** add stores links the panel already has (e.g. right after an upload). */
  add = (id: string, ref: MediaRef) => {
    this.refs.set(id, { ref, at: Date.now() });
    this.bump();
  };

  request = (ids: string[]) => {
    for (const id of ids) {
      if (this.get(id)) continue;
      const hit = this.refs.get(id);
      if (this.asked.has(id) && !hit) continue; // unknown on the server: do not ask again
      this.queue.add(id);
    }
    if (this.queue.size && !this.timer) this.timer = setTimeout(this.flush, 0);
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  version = () => this.v;

  private flush = async () => {
    this.timer = undefined;
    const ids = [...this.queue].slice(0, MAX_PER_REQUEST);
    ids.forEach((id) => {
      this.queue.delete(id);
      this.asked.add(id);
    });
    if (this.queue.size) this.timer = setTimeout(this.flush, 0);
    try {
      const refs = await mediaApi.links(ids);
      const now = Date.now();
      for (const [id, ref] of Object.entries(refs)) this.refs.set(id, { ref, at: now });
      this.bump();
    } catch {
      ids.forEach((id) => this.asked.delete(id)); // try again on the next render
    }
  };

  private bump() {
    this.v++;
    this.listeners.forEach((l) => l());
  }
}

let shared: PanelMediaSource | null = null;
/** panelMedia is the one source of the panel (also used by the editor after uploads). */
export function panelMedia(): PanelMediaSource {
  shared ??= new PanelMediaSource();
  return shared;
}

export function MediaProvider({ children }: { children: ReactNode }) {
  const source = useMemo(() => panelMedia(), []);
  return <MediaContext.Provider value={source}>{children}</MediaContext.Provider>;
}
