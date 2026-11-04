import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { MediaRef, MediaRefs } from '@/shared/api/types';

/**
 * MediaSource resolves data-media-id to a signed link. Item HTML never carries `src`
 * (the server strips it); RichContent fills it in from the nearest source after sanitizing.
 * The exam client passes the map that came with the attempt; the panel asks the server
 * for links on demand (app/components/MediaProvider).
 */
export interface MediaSource {
  get(id: string): MediaRef | undefined;
  /** Ask for links that are not known yet (no-op for a fixed map). */
  request(ids: string[]): void;
  subscribe(fn: () => void): () => void;
  /** Changes whenever new links arrive. */
  version(): number;
}

const none: MediaSource = {
  get: () => undefined,
  request: () => {},
  subscribe: () => () => {},
  version: () => 0,
};

export const MediaContext = createContext<MediaSource>(none);

/** StaticMedia provides a fixed map (exam attempt, result page). */
export function StaticMedia({ refs, children }: { refs: MediaRefs | undefined; children: ReactNode }) {
  const source = useMemo<MediaSource>(() => ({ ...none, get: (id) => refs?.[id] }), [refs]);
  return <MediaContext.Provider value={source}>{children}</MediaContext.Provider>;
}

/** useMedia returns the current source and re-renders when links arrive. */
export function useMedia(): MediaSource {
  const source = useContext(MediaContext);
  useSyncExternalStore(source.subscribe, source.version, source.version);
  return source;
}

/**
 * hydrateMedia sets src (and the intrinsic size, so the layout does not jump) on every
 * element with data-media-id under root, and returns the ids it could not resolve.
 */
export function hydrateMedia(root: HTMLElement, source: MediaSource): string[] {
  const missing: string[] = [];
  root.querySelectorAll<HTMLElement>('[data-media-id]').forEach((node) => {
    const id = node.getAttribute('data-media-id') ?? '';
    const ref = source.get(id);
    if (!ref) {
      if (!missing.includes(id)) missing.push(id);
      return;
    }
    if (node.getAttribute('src') !== ref.url) node.setAttribute('src', ref.url);
    if (node instanceof HTMLImageElement) {
      node.decoding = 'async';
      if (ref.w && ref.h) {
        node.width = ref.w;
        node.height = ref.h;
      }
    }
  });
  return missing;
}

/** mediaIds lists the data-media-id values in html. */
export function mediaIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const m of html.matchAll(/data-media-id="([0-9a-fA-F-]{36})"/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
