import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Page } from '@/shared/api/client';
import type { Bank, ExamSummary, Group, SessionSummary, Stimulus, Subject, User } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/format';
import { Badge, control, cx, Input, invalidCls, Spinner } from '@/shared/ui';
import { bankApi, examApi, groupApi, sessionApi, subjectApi, userApi } from '../api';

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchInput({ value, onChange, placeholder = 'Cari…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <Input className="pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ── searchable selects ─────────────────────────────────────────
// A plain <select> can only list what was loaded, and list endpoints return at most 100
// rows: anything after that silently disappeared. SearchSelect asks the server (q, one
// small page) instead, and fetches the selected item by id so its label shows even when
// it is not among the results.

const PICK_PAGE = 20;

/** Resource names double as React Query prefixes, so invalidating e.g. ['banks'] after a
 * rename also refreshes picker labels and lookups. */
type Kind = 'banks' | 'groups' | 'subjects' | 'exams' | 'sessions' | 'stimuli';

/** useLookup fetches the given ids one by one (cached per id) and returns a getter. It replaces
 * "load the first 100 and find the name", which showed "—" for everything after the 100th. */
export function useLookup<T>(kind: Kind, ids: (string | null | undefined)[], fetchOne: (id: string) => Promise<T>) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const results = useQueries({
    queries: unique.map((id) => ({ queryKey: [kind, 'lookup', id], queryFn: () => fetchOne(id), staleTime: 60_000, retry: false })),
  });
  const byId = new Map<string, T>();
  unique.forEach((id, i) => {
    const d = results[i]?.data;
    if (d) byId.set(id, d);
  });
  return (id: string | null | undefined) => (id ? byId.get(id) : undefined);
}

interface SearchSelectProps<T extends { id: string }> {
  value: string;
  onChange: (id: string, item: T | null) => void;
  kind: Kind;
  /** extra cache key parts for search (e.g. the bank of a stimulus list) */
  scope?: unknown[];
  search: (q: string) => Promise<Page<T>>;
  fetchOne: (id: string) => Promise<T>;
  label: (item: T) => string;
  detail?: (item: T) => ReactNode;
  placeholder: string;
  /** when set, an option that clears the value (e.g. "Semua grup") */
  emptyLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function SearchSelect<T extends { id: string }>({
  value,
  onChange,
  kind,
  scope = [],
  search,
  fetchOne,
  label,
  detail,
  placeholder,
  emptyLabel,
  invalid,
  disabled,
  className,
  'aria-label': ariaLabel,
}: SearchSelectProps<T>) {
  const qc = useQueryClient();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  const selected = useQuery({ queryKey: [kind, 'lookup', value], queryFn: () => fetchOne(value), enabled: !!value, staleTime: 60_000, retry: false });
  const results = useQuery({
    queryKey: [kind, 'search', ...scope, dq],
    queryFn: () => search(dq.trim()),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const items = results.data?.items ?? [];
  const options: (T | null)[] = emptyLabel !== undefined && !dq.trim() ? [null, ...items] : items;

  // the panel is portalled (modal bodies scroll and would clip it) and follows the trigger
  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setPos({ left: r.left, top: below < 300 && r.top > below ? r.top - 4 : r.bottom + 4, width: Math.max(r.width, 260), up: below < 300 && r.top > below });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => setActive(0), [dq, open]);

  const choose = (item: T | null) => {
    if (item) qc.setQueryData([kind, 'lookup', item.id], item);
    onChange(item?.id ?? '', item);
    setOpen(false);
    setQ('');
    button.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active] !== undefined) choose(options[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.nativeEvent.stopPropagation(); // close the picker, not the modal around it
      setOpen(false);
      button.current?.focus();
    }
  };

  const shown = value ? (selected.data ? label(selected.data) : selected.isError ? '—' : '…') : (emptyLabel ?? placeholder);
  const sizing = /(^|\s)(w-|max-w-|min-w-|sm:w-)/.test(className ?? '') ? className : cx('w-full', className);
  return (
    <div className={cx('relative', sizing)}>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(control, 'flex h-8 w-full items-center gap-2 py-0 pr-8 text-left', invalid && invalidCls, !value && !emptyLabel && 'text-slate-400 dark:text-slate-500')}
      >
        <span className="min-w-0 flex-1 truncate">{shown}</span>
      </button>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ left: pos.left, top: pos.top, width: pos.width, transform: pos.up ? 'translateY(-100%)' : undefined }}
            className="fixed z-[60] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="relative border-b border-slate-100 p-1.5 dark:border-slate-800">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ketik untuk mencari…"
                aria-label="Cari"
                aria-controls={listId}
                aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
                className="h-8 w-full rounded-lg bg-slate-50 pl-8 pr-8 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 dark:bg-slate-800 dark:text-white"
              />
              {results.isFetching && <Spinner className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />}
            </div>
            <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {options.map((it, i) => {
                const isSel = it ? it.id === value : !value;
                return (
                  <li
                    key={it?.id ?? '__empty'}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(it)}
                    className={cx('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs', i === active && 'bg-slate-100 dark:bg-slate-800')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-slate-900 dark:text-white', !it && 'text-slate-500 dark:text-slate-400')}>{it ? label(it) : emptyLabel}</span>
                      {it && detail && <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{detail(it)}</span>}
                    </span>
                    {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                  </li>
                );
              })}
              {results.data && items.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">Tidak ada hasil.</li>}
              {!results.data && <li className="px-3 py-2 text-xs text-slate-500">Memuat…</li>}
            </ul>
            {results.data && results.data.total > items.length && (
              <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] tabular-nums text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {items.length} dari {results.data.total} · ketik untuk mempersempit
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

type PickerProps = { value: string; onChange: (id: string) => void; emptyLabel?: string; invalid?: boolean; className?: string; 'aria-label'?: string };

export function SubjectSelect({ value, onChange, allowEmpty, invalid, className }: { value: string; onChange: (v: string) => void; allowEmpty?: string; invalid?: boolean; className?: string }) {
  return (
    <SearchSelect<Subject>
      kind="subjects"
      value={value}
      onChange={(id) => onChange(id)}
      search={(q) => subjectApi.list({ q, per_page: PICK_PAGE })}
      fetchOne={subjectApi.get}
      label={(s) => `${s.code} — ${s.name}`}
      placeholder="Pilih subjek…"
      emptyLabel={allowEmpty}
      invalid={invalid}
      className={className}
      aria-label="Subjek"
    />
  );
}

export function BankSelect({ value, onChange, emptyLabel, invalid, className }: PickerProps) {
  return (
    <SearchSelect<Bank>
      kind="banks"
      value={value}
      onChange={(id) => onChange(id)}
      search={(q) => bankApi.list({ q, per_page: PICK_PAGE })}
      fetchOne={bankApi.get}
      label={(b) => b.name}
      detail={(b) => `${b.item_count} soal`}
      placeholder="Pilih bank soal…"
      emptyLabel={emptyLabel}
      invalid={invalid}
      className={className}
      aria-label="Bank soal"
    />
  );
}

export function GroupSelect({ value, onChange, emptyLabel, invalid, className, exclude, 'aria-label': ariaLabel = 'Grup' }: PickerProps & { exclude?: string }) {
  return (
    <SearchSelect<Group>
      kind="groups"
      value={value}
      onChange={(id) => onChange(id)}
      search={async (q) => {
        const page = await groupApi.list({ q, per_page: PICK_PAGE + (exclude ? 1 : 0) });
        if (!exclude) return page;
        const items = page.items.filter((g) => g.id !== exclude).slice(0, PICK_PAGE);
        return { ...page, items, total: page.total - (page.items.length - items.length) };
      }}
      scope={exclude ? ['not', exclude] : []}
      fetchOne={groupApi.get}
      label={(g) => g.name}
      detail={(g) => [g.code, `${g.member_count} anggota`].filter(Boolean).join(' · ')}
      placeholder="Pilih grup…"
      emptyLabel={emptyLabel}
      invalid={invalid}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

export function ExamSelect({ value, onChange, status, invalid, className }: PickerProps & { status?: string }) {
  return (
    <SearchSelect<ExamSummary>
      kind="exams"
      value={value}
      onChange={(id) => onChange(id)}
      scope={[status]}
      search={(q) => examApi.list({ q, status, per_page: PICK_PAGE })}
      fetchOne={examApi.get as unknown as (id: string) => Promise<ExamSummary>}
      label={(e) => e.title}
      placeholder="Pilih ujian…"
      invalid={invalid}
      className={className}
      aria-label="Ujian"
    />
  );
}

export function SessionSelect({ value, onChange, examId, emptyLabel, className }: PickerProps & { examId: string }) {
  return (
    <SearchSelect<SessionSummary>
      kind="sessions"
      value={value}
      onChange={(id) => onChange(id)}
      scope={[examId]}
      search={(q) => sessionApi.list({ q, exam_id: examId, per_page: PICK_PAGE })}
      fetchOne={sessionApi.get as unknown as (id: string) => Promise<SessionSummary>}
      label={(s) => s.name}
      detail={(s) => [formatDateTime(s.starts_at), s.room].filter(Boolean).join(' · ')}
      placeholder="Pilih sesi…"
      emptyLabel={emptyLabel}
      className={className}
      aria-label="Sesi"
    />
  );
}

export function StimulusSelect({ value, onChange, bankId, emptyLabel, className }: PickerProps & { bankId: string }) {
  return (
    <SearchSelect<Stimulus>
      kind="stimuli"
      value={value}
      onChange={(id) => onChange(id)}
      scope={[bankId]}
      search={(q) => bankApi.stimuli(bankId, { q, per_page: PICK_PAGE })}
      fetchOne={bankApi.stimulus}
      label={(s) => s.title}
      detail={(s) => `v${s.version_no}`}
      placeholder="Pilih stimulus…"
      emptyLabel={emptyLabel}
      className={className}
      aria-label="Stimulus"
    />
  );
}

/** UserPicker searches users and collects a selection (ids). */
export function UserPicker({
  selected,
  onChange,
  role,
  placeholder = 'Cari nama atau username…',
}: {
  selected: User[];
  onChange: (users: User[]) => void;
  role?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const res = useQuery({
    queryKey: ['user-search', dq, role],
    queryFn: () => userApi.list({ q: dq, role, per_page: 8, status: 'active' }),
    enabled: dq.trim().length >= 2,
  });
  const ids = new Set(selected.map((u) => u.id));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        {res.isFetching && <Spinner className="absolute right-3 top-2 h-4 w-4" />}
      </div>
      {dq.trim().length >= 2 && res.data && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {res.data.items.length === 0 && <p className="p-3 text-xs text-slate-500">Tidak ada hasil.</p>}
          {res.data.items.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={ids.has(u.id)}
              onClick={() => onChange([...selected, u])}
              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span>
                <span className="font-semibold">{u.full_name}</span> <span className="font-mono text-slate-500">{u.username}</span>
              </span>
              <span className="text-[11px] text-slate-400">{u.roles.join(', ')}</span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <Badge key={u.id} tone="blue">
              {u.full_name}
              <button type="button" aria-label="Hapus" onClick={() => onChange(selected.filter((x) => x.id !== u.id))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupPicker({ selected, onChange }: { selected: Group[]; onChange: (groups: Group[]) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const res = useQuery({ queryKey: ['group-search', dq], queryFn: () => groupApi.list({ q: dq, per_page: 10 }) });
  const ids = new Set(selected.map((g) => g.id));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari grup…" />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        {res.data?.items.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={ids.has(g.id)}
            onClick={() => onChange([...selected, g])}
            className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <span className="font-semibold">{g.name}</span>
            <span className="text-[11px] text-slate-400">{g.member_count} anggota</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((g) => (
            <Badge key={g.id} tone="blue">
              {g.name}
              <button type="button" aria-label="Hapus" onClick={() => onChange(selected.filter((x) => x.id !== g.id))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
