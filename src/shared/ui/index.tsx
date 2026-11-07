// Design system shared by both entries: slate surfaces, one accent from the institution
// (--accent, see shared/lib/brand.ts), dark mode via the .dark class. Tokens in styles.css.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Info, Loader2, Moon, Sun, X } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ── buttons ────────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 text-accent-fg shadow-xs hover:bg-blue-700 disabled:hover:bg-blue-600',
  secondary:
    'border border-slate-200 bg-white text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 disabled:hover:bg-rose-600',
  success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 disabled:hover:bg-emerald-600',
  warning: 'bg-amber-400 text-amber-950 shadow-xs hover:bg-amber-500 disabled:hover:bg-amber-400',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-xs', lg: 'h-10 px-4 text-sm' };
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ className, label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── form controls ──────────────────────────────────────────────
// Full width unless the caller sets a width (Tailwind cannot tell w-full and w-auto apart by order).
const width = (className?: string) => (/(^|\s)(w-|max-w-)/.test(className ?? '') ? '' : 'w-full');
/** control is the look of every form control (also used by SearchSelect's trigger). */
export const control =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/60';
export const invalidCls = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-700';

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} className={cx(control, 'h-8 py-0', width(className), invalid && invalidCls, className)} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  // width classes size the wrapper; everything else styles the select itself
  const parts = (className ?? '').split(/\s+/).filter(Boolean);
  const sizing = parts.filter((c) => /^(w-|max-w-|min-w-|flex-|shrink|grow|basis-|sm:w-|md:w-|lg:w-)/.test(c));
  const rest2 = parts.filter((c) => !sizing.includes(c));
  return (
    <div className={cx('relative', sizing.length ? sizing.join(' ') : 'w-full')}>
      <select {...rest} className={cx(control, 'h-8 w-full appearance-none py-0 pr-8', invalid && invalidCls, rest2.join(' '))}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} className={cx(control, width(className), 'min-h-20 leading-relaxed', invalid && invalidCls, className)} />;
}

/**
 * Field labels one control. Set `group` for composite controls (rich editor, pickers):
 * a <label> forwards every click inside it to its first button or input, so clicking
 * an editor wrapped in a label would press the editor's first toolbar button.
 */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  group = false,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  group?: boolean;
}) {
  const id = useId();
  const body = (
    <>
      <span id={`${id}-label`} className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </>
  );
  return group ? (
    <div role="group" aria-labelledby={`${id}-label`} className={cx('block', className)}>
      {body}
    </div>
  ) : (
    <label className={cx('block', className)}>{body}</label>
  );
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer select-none items-center gap-2 text-xs text-slate-700 dark:text-slate-300', className)}>
      <input type="checkbox" {...rest} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

// ── surfaces ───────────────────────────────────────────────────
export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || actions) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-balance text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red';
const tones: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/25',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/25',
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin text-slate-400', className)} />;
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 [&_svg]:h-5 [&_svg]:w-5 dark:border-slate-700 dark:bg-slate-800">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {children && <div className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

const alertTones = {
  red: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200',
  blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200',
};

export function Alert({ tone = 'red', children, className }: { tone?: 'red' | 'amber' | 'blue' | 'green'; children: ReactNode; className?: string }) {
  const Icon = { red: AlertCircle, amber: AlertTriangle, blue: Info, green: CheckCircle2 }[tone];
  return (
    <div role={tone === 'red' ? 'alert' : undefined} className={cx('flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs', alertTones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ── modal ──────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center dark:bg-black/60" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx('my-8 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900', widths[size])}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Ya, lanjutkan',
  tone = 'primary',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  tone?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button variant={tone} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </Modal>
  );
}

// ── table & pagination ─────────────────────────────────────────
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900', className)}>
      <table className="w-full text-left text-xs tabular-nums [&_tbody_tr:first-child>td]:border-t-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/70 dark:[&_tbody_tr:hover]:bg-slate-800/40">{children}</table>
    </div>
  );
}
export const th =
  'h-9 whitespace-nowrap border-b border-slate-200 bg-slate-50/80 px-4 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';
export const td = 'border-t border-slate-100 px-4 py-2.5 align-middle text-slate-700 dark:border-slate-800 dark:text-slate-300';

export function Pagination({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return total > 0 ? <p className="mt-3 text-xs tabular-nums text-slate-500">{total} data</p> : null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs tabular-nums text-slate-500">
      <span>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} dari {total}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Sebelumnya" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <span className="px-2">
          {page} / {pages}
        </span>
        <IconButton label="Berikutnya" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="mb-5 flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-200 dark:border-slate-800">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-xs font-medium transition-colors',
            value === it.value
              ? 'border-blue-600 text-slate-900 dark:border-blue-400 dark:text-white'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

const statIcon: Record<Tone, string> = {
  slate: 'text-slate-400',
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-rose-600 dark:text-rose-400',
};

export function Stat({ label, value, tone = 'slate', icon }: { label: ReactNode; value: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {icon && <span className={cx('[&_svg]:h-4 [&_svg]:w-4', statIcon[tone])}>{icon}</span>}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── theme ──────────────────────────────────────────────────────
const THEME_KEY = 'doexam.theme';

export function initTheme() {
  let t: string | null = null;
  try {
    t = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  const dark = t ? t === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', !!dark);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
  };
  return (
    <IconButton label={dark ? 'Tema terang' : 'Tema gelap'} onClick={toggle}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </IconButton>
  );
}

// ── toasts ─────────────────────────────────────────────────────
type ToastType = 'success' | 'warning' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}
const ToastContext = createContext<(type: ToastType, title: string, message?: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 7000 : 4000);
  }, []);
  const iconTone: Record<ToastType, string> = {
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-500',
    error: 'text-rose-600 dark:text-rose-400',
    info: 'text-blue-600 dark:text-blue-400',
  };
  const icons = { success: CheckCircle2, warning: AlertTriangle, error: AlertCircle, info: Info };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] w-full max-w-sm space-y-2">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', iconTone[t.type])} />
              <div className="flex-1 text-xs">
                <p className="font-semibold">{t.title}</p>
                {t.message && <p className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">{t.message}</p>}
              </div>
              <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Tutup">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
