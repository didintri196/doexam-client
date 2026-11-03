import { Bold, Italic, List, ListOrdered, Sigma, Subscript, Superscript, Underline } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichContent, sanitize } from '@/shared/item/RichContent';
import { Button, cx, Input } from '@/shared/ui';

// Light rich-text editor for item stems, options, stimuli and explanations. Output is HTML
// within the server allowlist (§4.1); formulas are stored as <span data-math="LaTeX">.
// TipTap + MathLive can replace it later without changing the stored format.

function prepare(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-math], [data-math-block]').forEach((n) => {
    n.contentEditable = 'false';
    n.textContent = n.getAttribute('data-math') ?? n.getAttribute('data-math-block') ?? '';
  });
}

// execCommand writes <b>/<i>; the server allowlist only keeps <strong>/<em>.
const renames: Record<string, string> = { B: 'strong', I: 'em', STRIKE: 's' };
function normalizeTags(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('b, i, strike').forEach((el) => {
    const repl = document.createElement(renames[el.tagName]);
    repl.append(...el.childNodes);
    el.replaceWith(repl);
  });
  return root.innerHTML;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 'min-h-24',
  invalid,
  preview = true,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  preview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  const [mathOpen, setMathOpen] = useState(false);
  const [tex, setTex] = useState('');
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === last.current) return;
    el.innerHTML = sanitize(value);
    prepare(el);
    last.current = value;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitize(normalizeTags(el.innerHTML)).trim();
    const out = html === '<br>' ? '' : html;
    last.current = out;
    onChange(out);
  };

  const cmd = (name: string) => {
    ref.current?.focus();
    document.execCommand(name);
    emit();
  };

  const openMath = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setTex('');
    setMathOpen(true);
  };

  const insertMath = () => {
    const el = ref.current;
    if (!el || !tex.trim()) return;
    el.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    } else if (sel) {
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
    document.execCommand('insertHTML', false, `<span data-math="${escapeAttr(tex.trim())}">${escapeAttr(tex.trim())}</span>&nbsp;`);
    prepare(el);
    setMathOpen(false);
    emit();
  };

  const tool = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {icon}
    </button>
  );
  const i = 'h-3.5 w-3.5';

  return (
    <div className="space-y-2">
      <div className={cx('overflow-hidden rounded-xl border bg-white dark:bg-slate-800', invalid ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700')}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-900">
          {tool('Tebal', <Bold className={i} />, () => cmd('bold'))}
          {tool('Miring', <Italic className={i} />, () => cmd('italic'))}
          {tool('Garis bawah', <Underline className={i} />, () => cmd('underline'))}
          {tool('Subskrip', <Subscript className={i} />, () => cmd('subscript'))}
          {tool('Superskrip', <Superscript className={i} />, () => cmd('superscript'))}
          {tool('Daftar', <List className={i} />, () => cmd('insertUnorderedList'))}
          {tool('Daftar bernomor', <ListOrdered className={i} />, () => cmd('insertOrderedList'))}
          {tool('Sisipkan rumus (LaTeX)', <Sigma className={i} />, openMath)}
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emit}
          onBlur={emit}
          className={cx('rich rich-editor px-3 py-2 text-sm text-slate-900 dark:text-white', minHeight)}
        />
      </div>
      {mathOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/40">
          <Sigma className="h-4 w-4 shrink-0 text-blue-600" />
          <Input
            autoFocus
            value={tex}
            onChange={(e) => setTex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertMath();
              }
              if (e.key === 'Escape') setMathOpen(false);
            }}
            placeholder="mis. \frac{a}{b} atau x^2 + y^2 = r^2"
            className="font-mono"
          />
          {tex && <RichContent html={`<span data-math="${escapeAttr(tex)}"></span>`} className="shrink-0 text-sm" inline />}
          <Button size="sm" onClick={insertMath}>
            Sisipkan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMathOpen(false)}>
            Batal
          </Button>
        </div>
      )}
      {preview && value && /data-math/.test(value) && (
        <div className="rounded-xl border border-dashed border-slate-300 p-2.5 text-sm dark:border-slate-700">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pratinjau</p>
          <RichContent html={value} />
        </div>
      )}
    </div>
  );
}
