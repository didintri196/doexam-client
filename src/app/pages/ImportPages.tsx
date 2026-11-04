import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Group } from '@/shared/api/types';
import { formatNumber } from '@/shared/lib/format';
import { Input, Loading, Modal, PageHeader } from '@/shared/ui';
import { groupApi } from '../api';
import { ImportWizard } from '../components/ImportWizard';
import { useDebounced } from '../components/pickers';

// Excel imports live on the page of the data they create (DOCS/PLAN/13-IMPOR-PER-MENU.md).

function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
      <ArrowLeft className="h-3.5 w-3.5" /> {children}
    </Link>
  );
}

export function StaffImportPage() {
  return (
    <>
      <PageHeader title="Impor staf" subtitle="Tambahkan banyak akun staf sekaligus. Semua baris diperiksa dulu sebelum disimpan." back={<BackLink to="/users/staff">Staf</BackLink>} />
      <ImportWizard
        target={{ kind: 'users', audience: 'staff', template: 'template-staf.xlsx' }}
        help={
          <>
            Kolom <span className="font-mono">roles</span> wajib diisi dengan peran staf: <span className="font-mono">admin</span>, <span className="font-mono">author</span>,{' '}
            <span className="font-mono">proctor</span>, atau <span className="font-mono">grader</span>. Peserta diimpor dari halaman Peserta.
          </>
        }
      />
    </>
  );
}

export function ParticipantImportPage() {
  return (
    <>
      <PageHeader title="Impor peserta" subtitle="Tambahkan banyak akun peserta sekaligus. Semua baris diperiksa dulu sebelum disimpan." back={<BackLink to="/users/participants">Peserta</BackLink>} />
      <ImportWizard
        target={{ kind: 'users', audience: 'participant', template: 'template-peserta.xlsx' }}
        help={
          <>
            Semua baris menjadi peserta. Isi kolom <span className="font-mono">groups</span> (kode grup) agar langsung masuk grup, atau impor dari halaman Grup peserta untuk satu grup.
          </>
        }
      />
    </>
  );
}

/** GroupImportPage imports a participant list into one group; existing accounts are added. */
export function GroupImportPage() {
  const { id = '' } = useParams();
  const group = useQuery({ queryKey: ['groups', id], queryFn: () => groupApi.get(id) });
  if (group.isLoading) return <Loading />;
  const g = group.data;
  return (
    <>
      <PageHeader
        title={g ? `Impor peserta ke ${g.name}` : 'Impor peserta ke grup'}
        subtitle={g ? [g.code, g.period, `${formatNumber(g.member_count)} anggota sekarang`].filter(Boolean).join(' · ') : undefined}
        back={<BackLink to="/groups">Grup peserta</BackLink>}
      />
      <ImportWizard
        target={{ kind: 'users', audience: 'participant', groupId: id, template: 'template-peserta-grup.xlsx' }}
        help={
          <>
            Semua baris masuk ke grup ini. Peserta yang <strong>sudah punya akun</strong> (username atau ID peserta sama) cukup ditambahkan ke grup tanpa mengubah datanya; yang
            sudah anggota dilewati. Akun baru dibuat untuk sisanya.
          </>
        }
      />
    </>
  );
}

/** GroupListImportPage creates many groups at once (kind=groups). */
export function GroupListImportPage() {
  return (
    <>
      <PageHeader title="Impor daftar grup" subtitle="Buat banyak grup sekaligus, termasuk grup induknya." back={<BackLink to="/groups">Grup peserta</BackLink>} />
      <ImportWizard target={{ kind: 'groups', template: 'template-impor-groups.xlsx' }} />
    </>
  );
}

/** GroupPickerDialog chooses the group to import participants into. */
export function GroupPickerDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const res = useQuery({ queryKey: ['group-search', dq], queryFn: () => groupApi.list({ q: dq, per_page: 20 }) });
  const pick = (g: Group) => navigate(`/groups/${g.id}/import`);
  return (
    <Modal open onClose={onClose} title="Impor peserta ke grup" size="sm">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Pilih grup tujuan. Daftar peserta di file akan dimasukkan ke grup ini.</p>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau kode grup…" autoFocus />
      </div>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        {res.isLoading ? (
          <Loading />
        ) : !res.data?.items.length ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">Tidak ada grup yang cocok.</p>
        ) : (
          res.data.items.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(g)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-xs last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900 dark:text-white">{g.name}</span>
                <span className="text-[11px] text-slate-500">{[g.code, g.period].filter(Boolean).join(' · ') || '—'}</span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{formatNumber(g.member_count)} anggota</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
