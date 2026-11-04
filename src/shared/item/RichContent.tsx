import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/shared/ui';
import { LimitedAudio, useAudioPlays } from './audio';
import { hydrateMedia, useMedia } from './media';

// Same allowlist as the server (apps/server/pkg/richtext). The server already sanitized
// the HTML; this second pass is defense in depth (09-FRONTEND §5.5). `src` is not allowed:
// media are referenced by data-media-id and resolved to signed links after sanitizing.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'pre', 'code', 'img', 'audio', 'video', 'source',
];
const ALLOWED_ATTR = [
  'data-math', 'data-math-block', 'data-media-id', 'data-max-plays', 'data-allow-pause', 'alt', 'controls', 'colspan', 'rowspan', 'dir', 'lang', 'class',
];

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
}

type Katex = typeof import('katex').default;
let katexPromise: Promise<Katex> | null = null;
// KaTeX is loaded only when a formula is on screen: it is the largest dependency of the exam bundle.
function loadKatex() {
  katexPromise ??= import('katex').then((m) => m.default);
  return katexPromise;
}

/** renderMath replaces <span data-math> / <div data-math-block> with typeset formulas. */
export function renderMath(root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>('span[data-math], div[data-math-block]');
  if (nodes.length === 0) return;
  void loadKatex().then((katex) => {
    nodes.forEach((node) => {
      const block = node.hasAttribute('data-math-block');
      const tex = node.getAttribute(block ? 'data-math-block' : 'data-math') ?? '';
      try {
        katex.render(tex, node, { displayMode: block, throwOnError: false, trust: false, strict: 'ignore' });
      } catch {
        node.textContent = tex;
      }
    });
  });
}

/** RichContent renders sanitized item HTML (stem, options, stimulus, explanation). */
export function RichContent({ html, className, inline }: { html: string | null | undefined; className?: string; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const media = useMedia();
  const clean = useMemo(() => sanitize(html ?? ''), [html]);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const plays = useAudioPlays();
  const limited = plays !== null;
  const [clips, setClips] = useState<Clip[]>([]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = clean;
    renderMath(el);
    setClips(prepareAudio(el, limited));
  }, [clean, limited]);

  // Links can arrive after the first paint (panel), so hydrate on every new version.
  const version = media.version();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const missing = hydrateMedia(el, media);
    if (missing.length) media.request(missing);
  }, [clean, media, version]);

  const onClick = (e: MouseEvent) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.src && t.closest('.rich-zoomable')) {
      e.preventDefault();
      e.stopPropagation(); // an image inside an option must not select the option
      setZoom({ src: t.src, alt: t.alt });
    }
  };

  const Tag = inline ? 'span' : 'div';
  return (
    <>
      <Tag ref={ref} onClick={onClick} className={cx('rich rich-zoomable', className)} />
      {clips.map((c) => createPortal(<LimitedAudio mediaId={c.mediaId} max={c.max} allowPause={c.allowPause} />, c.slot, c.key))}
      {zoom && <ImageZoom src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </>
  );
}

interface Clip {
  key: string;
  slot: HTMLElement;
  mediaId: string;
  max: number;
  allowPause: boolean;
}

/**
 * prepareAudio gives every clip native controls, except clips with a play limit while an
 * exam engine counts plays: those are swapped for a slot that LimitedAudio renders into.
 */
function prepareAudio(root: HTMLElement, limited: boolean): Clip[] {
  const clips: Clip[] = [];
  root.querySelectorAll<HTMLAudioElement>('audio[data-media-id]').forEach((a, i) => {
    const max = Number(a.getAttribute('data-max-plays'));
    if (limited && max >= 1) {
      const slot = document.createElement('span');
      slot.className = 'block';
      a.replaceWith(slot);
      clips.push({ key: `${i}-${a.getAttribute('data-media-id')}`, slot, mediaId: a.getAttribute('data-media-id') ?? '', max, allowPause: a.getAttribute('data-allow-pause') === 'true' });
      return;
    }
    a.controls = true;
    a.preload = 'metadata';
    a.setAttribute('controlslist', 'nodownload noplaybackrate');
    if (max >= 1) a.title = `Peserta: maksimal ${max}× putar${a.getAttribute('data-allow-pause') === 'true' ? '' : ', tanpa jeda'}`;
  });
  return clips;
}

/** ImageZoom shows one picture over the page; click or Escape closes it. */
function ImageZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // Portal + stopPropagation: the picture may sit inside an answer option (a button);
  // closing the zoom must not select that option.
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Gambar diperbesar'}
      onClick={stop}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 sm:p-10"
    >
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-md bg-white object-contain shadow-2xl" />
      <button
        ref={close}
        type="button"
        onClick={stop}
        aria-label="Tutup gambar"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}

/** plainText strips tags for previews and labels. */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = sanitize(html);
  return (d.textContent ?? '').replace(/\s+/g, ' ').trim();
}
