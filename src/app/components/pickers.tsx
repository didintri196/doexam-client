import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Group, Subject, User } from '@/shared/api/types';
import { Badge, Input, Select, Spinner } from '@/shared/ui';
import { groupApi, subjectApi, userApi } from '../api';

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

export function useSubjects() {
  return useQuery({ queryKey: ['subjects'], queryFn: () => subjectApi.list(), staleTime: 60_000 });
}

export function SubjectSelect({ value, onChange, allowEmpty, invalid }: { value: string; onChange: (v: string) => void; allowEmpty?: string; invalid?: boolean }) {
  const { data } = useSubjects();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid}>
      {allowEmpty !== undefined ? <option value="">{allowEmpty}</option> : <option value="" disabled>Pilih subjek…</option>}
      {data?.items.map((s: Subject) => (
        <option key={s.id} value={s.id}>
          {s.code} — {s.name}
        </option>
      ))}
    </Select>
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
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kelas / grup…" />
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
