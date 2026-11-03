import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Clock, FileBarChart, Lock, MoreHorizontal, MonitorSmartphone, Send, Tv2, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MonitorRow, Session } from '@/shared/api/types';
import { formatClock, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, ConfirmDialog, cx, Field, Input, Loading, Modal, PageHeader, Table, td, th } from '@/shared/ui';
import { attemptApi, sessionApi } from '../api';
import { useAction } from '../components/hooks';
import { SearchInput } from '../components/pickers';
import { Perm, useCan } from '../perm';
import { useToken } from './SessionDetailPage';
import { sessionTone } from './SessionsPage';

const statusTone = { in_progress: 'blue', locked: 'amber', submitted: 'green', graded: 'green', void: 'red' } as const;
const IDLE_SECONDS = 120;

export function MonitorPage() {
  const { id = '' } = useParams();
  const session = useQuery({ queryKey: ['session', id], queryFn: () => sessionApi.get(id) });
  // polling every 5 s (realtime push is a later backend item, 09-FRONTEND §9 #6)
  const monitor = useQuery({ queryKey: ['monitor', id], queryFn: () => sessionApi.monitor(id), refetchInterval: 5000 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const m = monitor.data;
  const serverNow = m ? Date.parse(m.server_time) : Date.now();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (m?.rows ?? [])
      .filter((r) => !needle || r.full_name.toLowerCase().includes(needle) || r.username.toLowerCase().includes(needle) || (r.seat ?? '').toLowerCase().includes(needle))
      .filter((r) => {
        if (!filter) return true;
        if (filter === 'not_started') return !r.status;
        if (filter === 'attention') return r.violations > 0 || isIdle(r, serverNow);
        return r.status === filter;
      })
      .sort((a, b) => (a.seat ?? '').localeCompare(b.seat ?? '', 'id', { numeric: true }) || a.full_name.localeCompare(b.full_name));
  }, [m, q, filter, serverNow]);

  if (session.isLoading || !session.data) return <Loading />;
  const s = session.data;
  const c = m?.counts ?? {};

  return (
    <>
      <PageHeader
        title={`Monitor · ${s.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={sessionTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
            {s.exam.title}
            {s.room && ` · ${s.room}`}
            {m && (
              <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-slate-500">
                <span className={cx('h-1.5 w-1.5 rounded-full', monitor.error ? 'bg-rose-500' : 'bg-emerald-500')} />
                Diperbarui {new Date(monitor.dataUpdatedAt).toLocaleTimeString('id-ID')}
              </span>
            )}
          </span>
        }
        back={
          <Link to={`/sessions/${id}`} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Detail sesi
          </Link>
        }
        actions={
          <>
            <MiniToken session={s} />
            {s.token_required && (
              <a href={`/app/sessions/${id}/board`} target="_blank" rel="noreferrer">
                <Button variant="secondary" icon={<Tv2 className="h-4 w-4" />}>
                  Layar proyektor
                </Button>
              </a>
            )}
          </>
        }
      />
      {s.status === 'scheduled' && <Alert tone="amber" className="mb-4">Sesi belum dibuka. Peserta belum bisa mulai sampai sesi dibuka di halaman detail sesi.</Alert>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Saring status" className="flex flex-wrap gap-1.5">
          {[
            { v: '', label: 'Semua', n: m?.rows.length ?? 0, dot: '' },
            { v: 'not_started', label: 'Belum mulai', n: c.not_started ?? 0, dot: 'bg-slate-400' },
            { v: 'in_progress', label: 'Mengerjakan', n: c.in_progress ?? 0, dot: 'bg-blue-600' },
            { v: 'locked', label: 'Dikunci', n: c.locked ?? 0, dot: 'bg-amber-500' },
            { v: 'submitted', label: 'Dikumpulkan', n: (c.submitted ?? 0) + (c.graded ?? 0), dot: 'bg-emerald-500' },
            { v: 'attention', label: 'Perlu perhatian', n: (m?.rows ?? []).filter((r) => r.violations > 0 || isIdle(r, serverNow)).length, dot: 'bg-rose-500' },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              role="tab"
              aria-selected={filter === f.v}
              onClick={() => setFilter(f.v)}
              className={cx(
                'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
                filter === f.v
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                f.v === 'attention' && f.n > 0 && filter !== f.v && 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300',
              )}
            >
              {f.dot && <span className={cx('h-2 w-2 rounded-full', f.dot)} />}
              {f.label}
              <span className={cx('tabular-nums', filter === f.v ? 'opacity-70' : 'text-slate-500 dark:text-slate-400')}>{f.n}</span>
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama, username, kursi…" />
      </div>
      {monitor.error && <Alert className="mb-4">Gagal memuat monitor. Mencoba lagi…</Alert>}
      <Table>
        <thead>
          <tr>
            <th className={th}>Kursi</th>
            <th className={th}>Peserta</th>
            <th className={th}>Status</th>
            <th className={th}>Progres</th>
            <th className={th}>Sisa waktu</th>
            <th className={th}>Terakhir aktif</th>
            <th className={th}>Pelanggaran</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.user_id} row={r} serverNow={serverNow} sessionId={id} />
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && m && <p className="mt-4 text-center text-xs text-slate-500">Tidak ada peserta yang cocok.</p>}
    </>
  );
}

function isIdle(r: MonitorRow, now: number) {
  return r.status === 'in_progress' && !!r.last_seen_at && (now - Date.parse(r.last_seen_at)) / 1000 > IDLE_SECONDS;
}

function ago(iso: string | null, now: number) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
}

function MiniToken({ session }: { session: Session }) {
  const { token, left, enabled } = useToken(session);
  if (!enabled || !token.data) return null;
  return (
    <div className="flex h-8 items-center gap-2.5 rounded-lg border border-slate-200 bg-white pl-3 pr-2.5 shadow-xs dark:border-slate-700 dark:bg-slate-900">
      <span className="text-xs text-slate-500 dark:text-slate-400">Token</span>
      <span className="font-mono text-sm font-semibold tracking-[0.2em] text-slate-900 dark:text-white">{token.data.code}</span>
      <span className="text-[11px] tabular-nums text-slate-500">{formatClock(left)}</span>
    </div>
  );
}

type ActionKind = 'extend' | 'lock' | 'unlock' | 'reset' | 'submit';

function Row({ row: r, serverNow, sessionId }: { row: MonitorRow; serverNow: number; sessionId: string }) {
  const can = useCan();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [minutes, setMinutes] = useState('10');
  const idle = isIdle(r, serverNow);
  const pct = r.item_count ? Math.round((r.answered / r.item_count) * 100) : 0;
  const left = r.deadline_at && r.status === 'in_progress' ? Math.max(0, (Date.parse(r.deadline_at) - serverNow) / 1000) : null;
  const run = useAction(
    async (k: ActionKind) => {
      const id = r.attempt_id!;
      if (k === 'extend') return attemptApi.extend(id, Number(minutes));
      if (k === 'lock') return attemptApi.lock(id);
      if (k === 'unlock') return attemptApi.unlock(id);
      if (k === 'reset') return attemptApi.resetDevice(id);
      return attemptApi.forceSubmit(id);
    },
    {
      success: 'Tindakan dijalankan',
      onSuccess: () => {
        setAction(null);
        void qc.invalidateQueries({ queryKey: ['monitor', sessionId] });
      },
    },
  );
  const acts: { k: ActionKind; label: string; icon: React.ReactNode; show: boolean }[] = [
    { k: 'extend', label: 'Tambah waktu', icon: <Clock className="h-3.5 w-3.5" />, show: r.status === 'in_progress' || r.status === 'locked' },
    { k: 'lock', label: 'Kunci', icon: <Lock className="h-3.5 w-3.5" />, show: r.status === 'in_progress' },
    { k: 'unlock', label: 'Buka kunci', icon: <Unlock className="h-3.5 w-3.5" />, show: r.status === 'locked' },
    { k: 'reset', label: 'Reset perangkat', icon: <MonitorSmartphone className="h-3.5 w-3.5" />, show: r.device_bound && (r.status === 'in_progress' || r.status === 'locked') },
    { k: 'submit', label: 'Kumpulkan paksa', icon: <Send className="h-3.5 w-3.5" />, show: r.status === 'in_progress' || r.status === 'locked' },
  ];
  const shown = acts.filter((a) => a.show);
  const texts: Record<ActionKind, string> = {
    extend: 'Waktu peserta ditambah (tidak bisa melewati akhir sesi).',
    lock: 'Peserta tidak bisa menjawab sampai dibuka kembali.',
    unlock: 'Peserta bisa melanjutkan ujian.',
    reset: 'Peserta bisa melanjutkan di perangkat lain (mis. PC rusak).',
    submit: 'Jawaban peserta dikumpulkan sekarang dan dinilai. Tidak bisa dibatalkan.',
  };
  return (
    <tr className={cx(idle || r.violations > 2 ? 'bg-rose-50/70 dark:bg-rose-950/25' : '')}>
      <td className={`${td} tabular-nums text-slate-500`}>{r.seat ?? '—'}</td>
      <td className={td}>
        <p className="font-medium text-slate-900 dark:text-white">{r.full_name}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.username}</p>
      </td>
      <td className={td}>
        {r.status ? <Badge tone={statusTone[r.status]}>{labels.attemptStatus[r.status]}</Badge> : <Badge>{labels.attendance[r.attendance] ?? 'Belum mulai'}</Badge>}
        {r.final_score !== null && <span className="ml-2 text-[11px] tabular-nums text-slate-500">{r.final_score}</span>}
      </td>
      <td className={td}>
        {r.status ? (
          <div className="w-28">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11px] tabular-nums text-slate-500">
              {r.answered}/{r.item_count}
            </p>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className={`${td} tabular-nums`}>{left === null ? '—' : formatClock(left)}</td>
      <td className={td}>
        <span className={idle ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-slate-500'}>{ago(r.last_seen_at, serverNow)}</span>
      </td>
      <td className={td}>
        {r.violations > 0 ? (
          <Badge tone={r.violations > 2 ? 'red' : 'amber'}>
            <AlertTriangle className="h-3 w-3" /> {r.violations}
          </Badge>
        ) : (
          '—'
        )}
      </td>
      <td className={`${td} text-right`}>
        <div className="relative inline-flex items-center gap-1">
          {r.attempt_id && (r.status === 'submitted' || r.status === 'graded') && can(Perm.ReportRead, Perm.TenantManage, Perm.GradeWrite) && (
            <Link
              to={`/reports/attempts/${r.attempt_id}`}
              title="Laporan peserta"
              aria-label="Laporan peserta"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <FileBarChart className="h-4 w-4" />
            </Link>
          )}
          {shown.length > 0 && (
            <button
              type="button"
              aria-expanded={menu}
              onClick={() => setMenu((x) => !x)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Tindakan"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
          {menu && (
            <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg dark:border-slate-700 dark:bg-slate-800" onMouseLeave={() => setMenu(false)}>
              {shown.map((a) => (
                <button
                  key={a.k}
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setAction(a.k);
                  }}
                  className={cx(
                    'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700',
                    a.k === 'submit' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200',
                  )}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {action === 'extend' ? (
          <Modal
            open
            onClose={() => setAction(null)}
            size="sm"
            title={`Tambah waktu — ${r.full_name}`}
            footer={
              <>
                <Button variant="secondary" onClick={() => setAction(null)}>
                  Batal
                </Button>
                <Button loading={run.isPending} onClick={() => run.mutate('extend')}>
                  Tambahkan
                </Button>
              </>
            }
          >
            <Field label="Menit" hint={texts.extend}>
              <Input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
          </Modal>
        ) : (
          action && (
            <ConfirmDialog
              open
              title={`${acts.find((a) => a.k === action)?.label} — ${r.full_name}`}
              tone={action === 'submit' ? 'danger' : 'primary'}
              loading={run.isPending}
              onClose={() => setAction(null)}
              onConfirm={() => run.mutate(action)}
            >
              {texts[action]}
            </ConfirmDialog>
          )
        )}
      </td>
    </tr>
  );
}
