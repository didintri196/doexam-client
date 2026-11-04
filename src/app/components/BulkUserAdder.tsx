import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Search, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import type { ResolveResult, UserStatus } from '@/shared/api/types';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { formatNumber } from '@/shared/lib/format';
import { Alert, Badge, Button, Field, Input, Spinner, Tabs, Textarea, cx } from '@/shared/ui';
import { userApi } from '../api';
import { useDebounced } from './pickers';

/** The fields of a user the adder needs; both User and ResolvedUser fit. */
export interface PickedUser {
  id: string;
  username: string;
  full_name: string;
  external_id: string | null;
  status?: UserStatus;
}

/** Server limit per request (users/resolve, group members, session participants). */
export const MAX_BULK = 5000;
const CHIP_LIMIT = 40;
const LIST_LIMIT = 30;

type Source = 'paste' | 'file' | 'search';

/**
 * BulkUserAdder collects many users at once: paste a column of usernames / ID peserta /
 * e-mails, upload an .xlsx/.csv, or tick search results. The parent owns the selection
 * and the final "add" action. `extra` adds one more tab (e.g. copy from another group)
 * that replaces the selection area while it is open.
 */
export function BulkUserAdder({
  selected,
  onChange,
  role,
  activeOnly = false,
  extra,
  action,
}: {
  selected: PickedUser[];
  onChange: (users: PickedUser[]) => void;
  role?: string;
  /** Skip suspended users (sessions accept active users only). */
  activeOnly?: boolean;
  extra?: { label: string; content: ReactNode };
  /** Rendered under the selection while it is not empty (e.g. role + "Tambahkan"). */
  action?: ReactNode;
}) {
  const [tab, setTab] = useState<Source | 'extra'>('paste');
  const [report, setReport] = useState<Report | null>(null);

  const merge = (found: PickedUser[]) => {
    const have = new Set(selected.map((u) => u.id));
    const fresh = found.filter((u) => !have.has(u.id));
    onChange([...selected, ...fresh]);
    return fresh.length;
  };
  const applyResult = (r: ResolveResult) => {
    const usable = activeOnly ? r.found.filter((u) => u.status === 'active') : r.found;
    const added = merge(usable);
    setReport({ added, already: usable.length - added, notFound: r.not_found, ambiguous: r.ambiguous, suspended: r.found.length - usable.length });
  };

  const items: { value: Source | 'extra'; label: string }[] = [
    { value: 'paste', label: 'Tempel daftar' },
    { value: 'file', label: 'Impor file' },
    { value: 'search', label: 'Cari' },
  ];
  if (extra) items.push({ value: 'extra', label: extra.label });

  return (
    <div>
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setReport(null);
        }}
        items={items}
      />
      {tab === 'extra' && extra ? (
        extra.content
      ) : (
        <div className="space-y-4">
          {tab === 'paste' && <PasteSource onResult={applyResult} />}
          {tab === 'file' && <FileSource onResult={applyResult} />}
          {tab === 'search' && <SearchSource selected={selected} onChange={onChange} role={role} activeOnly={activeOnly} />}
          {report && <ReportView report={report} onDismiss={() => setReport(null)} />}
          <Selection
            selected={selected}
            onChange={(users) => {
              if (!users.length) setReport(null); // "Kosongkan" also drops the stale summary
              onChange(users);
            }}
          />
          {selected.length > 0 && action}
        </div>
      )}
    </div>
  );
}

interface Report {
  added: number;
  already: number;
  notFound: string[];
  ambiguous: string[];
  suspended: number;
}

/** splitIdentifiers accepts one per line, or separated by comma, semicolon or tab. */
export function splitIdentifiers(text: string): string[] {
  return text
    .split(/[\n\r,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PasteSource({ onResult }: { onResult: (r: ResolveResult) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ids = splitIdentifiers(text);
  const tooMany = ids.length > MAX_BULK;

  const check = async () => {
    setBusy(true);
    setError(undefined);
    try {
      onResult(await userApi.resolve(ids));
      setText('');
    } catch (err) {
      setError(fieldErrors(err).identifiers ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Field
        label="Username, ID peserta, atau email"
        error={error ?? (tooMany ? `Maksimal ${formatNumber(MAX_BULK)} sekali periksa` : undefined)}
        hint="Satu per baris, atau dipisah koma. Bisa ditempel langsung dari satu kolom Excel."
      >
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'peserta001\npeserta002\nani@contoh.id'}
          className="font-mono"
        />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {ids.length > 0 && <span className="text-[11px] tabular-nums text-slate-500">{formatNumber(ids.length)} baris</span>}
        <Button size="sm" variant="secondary" disabled={!ids.length || tooMany} loading={busy} onClick={check}>
          Periksa
        </Button>
      </div>
    </div>
  );
}

function FileSource({ onResult }: { onResult: (r: ResolveResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [name, setName] = useState<string>();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setName(file.name);
    setBusy(true);
    setError(undefined);
    try {
      onResult(await userApi.resolveFile(file));
    } catch (err) {
      setError(fieldErrors(err).file ?? errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">File Excel atau CSV</p>
      <div className="flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv"
          aria-label="Pilih file Excel atau CSV"
          className="sr-only"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} loading={busy} onClick={() => input.current?.click()}>
          Pilih file
        </Button>
        {name && <span className="truncate font-mono text-xs text-slate-500">{name}</span>}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Baris pertama berisi judul kolom: <span className="font-mono">username</span>, <span className="font-mono">external_id</span>, atau{' '}
          <span className="font-mono">email</span>. Tanpa judul itu, kolom pertama yang dipakai. Maks. 5000 baris, 5 MB.
        </p>
      )}
    </div>
  );
}

function SearchSource({
  selected,
  onChange,
  role,
  activeOnly,
}: {
  selected: PickedUser[];
  onChange: (users: PickedUser[]) => void;
  role?: string;
  activeOnly: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const enabled = dq.trim().length >= 2;
  const res = useQuery({
    queryKey: ['user-search-bulk', dq, role, activeOnly],
    queryFn: () => userApi.list({ q: dq, role, per_page: 50, status: activeOnly ? 'active' : undefined }),
    enabled,
  });
  const ids = new Set(selected.map((u) => u.id));
  const rows = res.data?.items ?? [];
  const allPicked = rows.length > 0 && rows.every((u) => ids.has(u.id));

  const toggle = (u: PickedUser) => onChange(ids.has(u.id) ? selected.filter((x) => x.id !== u.id) : [...selected, u]);
  const toggleAll = () => {
    if (allPicked) {
      const drop = new Set(rows.map((u) => u.id));
      onChange(selected.filter((u) => !drop.has(u.id)));
    } else {
      onChange([...selected, ...rows.filter((u) => !ids.has(u.id))]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, username, atau ID peserta…" />
        {res.isFetching && <Spinner className="absolute right-3 top-2 h-4 w-4" />}
      </div>
      {enabled && res.data && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          {rows.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Tidak ada yang cocok dengan “{dq}”.</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={allPicked} onChange={toggleAll} />
                Pilih semua hasil ({formatNumber(rows.length)}
                {res.data.total > rows.length ? ` dari ${formatNumber(res.data.total)}` : ''})
              </label>
              <ul className="max-h-60 overflow-y-auto">
                {rows.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={ids.has(u.id)} onChange={() => toggle(u)} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{u.full_name}</span>{' '}
                        <span className="font-mono text-slate-500">{u.username}</span>
                      </span>
                      {u.external_id && <span className="font-mono text-[11px] text-slate-400">{u.external_id}</span>}
                      {u.status === 'suspended' && <Badge tone="amber">Nonaktif</Badge>}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {res.data && res.data.total > rows.length && (
        <p className="text-[11px] text-slate-500">Hanya 50 hasil pertama yang tampil. Untuk ratusan orang, pakai Tempel daftar atau Impor file.</p>
      )}
    </div>
  );
}

function ReportView({ report: r, onDismiss }: { report: Report; onDismiss: () => void }) {
  const problems = r.notFound.length + r.ambiguous.length + r.suspended;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-start justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
        <p>
          <span className="font-semibold tabular-nums">{formatNumber(r.added)}</span> orang masuk daftar.
          {r.already > 0 && <> {formatNumber(r.already)} sudah ada di daftar.</>}
        </p>
        <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600" aria-label="Tutup ringkasan">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {problems > 0 && (
        <Alert tone="amber">
          <div className="space-y-1.5">
            {r.notFound.length > 0 && <IdentifierList label="Tidak ditemukan" items={r.notFound} />}
            {r.ambiguous.length > 0 && <IdentifierList label="Cocok dengan lebih dari satu orang, pakai username" items={r.ambiguous} />}
            {r.suspended > 0 && <p>{formatNumber(r.suspended)} akun nonaktif dilewati.</p>}
          </div>
        </Alert>
      )}
    </div>
  );
}

function IdentifierList({ label, items }: { label: string; items: string[] }) {
  const shown = items.slice(0, LIST_LIMIT);
  return (
    <p>
      <span className="font-semibold">
        {label} ({formatNumber(items.length)}):
      </span>{' '}
      <span className="font-mono">{shown.join(', ')}</span>
      {items.length > shown.length && <> dan {formatNumber(items.length - shown.length)} lainnya</>}
    </p>
  );
}

function Selection({ selected, onChange }: { selected: PickedUser[]; onChange: (users: PickedUser[]) => void }) {
  if (!selected.length) return null;
  const shown = selected.slice(0, CHIP_LIMIT);
  const over = selected.length > MAX_BULK;
  return (
    <div className={cx('rounded-xl border p-3', over ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700')}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          <span className="tabular-nums">{formatNumber(selected.length)}</span> orang akan ditambahkan
          {over && <span className="ml-2 font-normal text-rose-600">maksimal {formatNumber(MAX_BULK)} sekali tambah</span>}
        </p>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Kosongkan
        </Button>
      </div>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map((u) => (
          <Badge key={u.id} tone="blue">
            {u.full_name}
            <button type="button" aria-label={`Hapus ${u.full_name} dari daftar`} onClick={() => onChange(selected.filter((x) => x.id !== u.id))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selected.length > shown.length && <Badge>+{formatNumber(selected.length - shown.length)} lainnya</Badge>}
      </div>
    </div>
  );
}
