import DOMPurify from 'dompurify';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { cx } from '@/shared/ui';

// Same allowlist as the server (apps/server/pkg/richtext). The server already sanitized
// the HTML; this second pass is defense in depth (09-FRONTEND §5.5).
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'pre', 'code', 'img', 'audio', 'video', 'source',
];
const ALLOWED_ATTR = ['data-math', 'data-math-block', 'data-media-id', 'alt', 'controls', 'colspan', 'rowspan', 'dir', 'lang', 'class'];

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
  const clean = useMemo(() => sanitize(html ?? ''), [html]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = clean;
    renderMath(el);
  }, [clean]);
  const Tag = inline ? 'span' : 'div';
  return <Tag ref={ref} className={cx('rich', className)} />;
}

/** plainText strips tags for previews and labels. */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = sanitize(html);
  return (d.textContent ?? '').replace(/\s+/g, ' ').trim();
}
