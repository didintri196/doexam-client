import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Clock,
  Eye,
  EyeOff,
  FileBarChart,
  Lock,
  Megaphone,
  MonitorSmartphone,
  MoreHorizontal,
  Send,
  Tv2,
  Unlock,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MonitorRow, MonitorView, Session, ViolationType } from '@/shared/api/types';
import { formatClock, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, ConfirmDialog, cx, EmptyState, Field, Input, Loading, Modal, PageHeader, Pagination, Select, useToast } from '@/shared/ui';
import { attemptApi, sessionApi } from '../api';
import { AnnounceDialog, AnnouncementHistory, useAnnouncements } from '../components/Announcements';
import { useAction } from '../components/hooks';
import { GroupSelect, SearchInput, useDebounced } from '../components/pickers';
import { Perm, useCan } from '../perm';
import { useToken } from './SessionDetailPage';
import { sessionTone } from './SessionsPage';

// DOCS/PLAN/15-MONITOR-KARTU.md: cards, 10 per page; every view is cut by the server, and the
// watch list (max 25) only asks for the participants it holds, so no poll loads a whole session.

const PER_PAGE = 10;
const MAX_WATCH = 25;
const statusTone = { in_progress: 'blue', locked: 'amber', submitted: 'green', graded: 'green', void: 'red' } as const;
const violationLabel: Record<ViolationType, string> = {
  focus_lost: 'Keluar halaman',
  fullscreen_exit: 'Keluar layar penuh',
  device_changed: 'Ganti perangkat',
};

type Tab = 'watch' | MonitorView;
type Picked = { user_id: string; full_name: string };

const tabs: { v: Tab; label: string; count: string; dot?: string }[] = [
  { v: 'watch', label: 'Dipantau', count: '' },
  { v: 'violations', label: 'Pelanggaran', count: 'violations', dot: 'bg-rose-500' },
  { v: 'idle', label: 'Tidak aktif', count: 'idle', dot: 'bg-orange-500' },
  { v: 'locked', label: 'Dikunci', count: 'locked', dot: 'bg-amber-500' },
  { v: 'not_started', label: 'Belum mulai', count: 'not_started', dot: 'bg-slate-400' },
  { v: 'in_progress', label: 'Mengerjakan', count: 'in_progress', dot: 'bg-blue-600' },
  { v: 'submitted', label: 'Dikumpulkan', count: 'submitted', dot: 'bg-emerald-500' },
  { v: 'all', label: 'Semua peserta', count: 'total' },
];

// status filter inside the watch list (applied in the browser: at most 25 rows)
const watchFilters: { v: string; label: string; match: (r: MonitorRow) => boolean }[] = [
  { v: '', label: 'Semua', match: () => true },
  { v: 'violations', label: 'Pelanggaran', match: (r) => r.violations > 0 },
  { v: 'idle', label: 'Tidak aktif', match: (r) => !!r.idle },
  { v: 'locked', label: 'Dikunci', match: (r) => r.status === 'locked' },
  { v: 'in_progress', label: 'Mengerjakan', match: (r) => r.status === 'in_progress' },
  { v: 'submitted', label: 'Dikumpulkan', match: (r) => r.status === 'submitted' || r.status === 'graded' },
  { v: 'not_started', label: 'Belum mulai', match: (r) => !r.status },
];

/** useWatchList keeps a proctor's watch list per session in this browser. */
function useWatchList(sessionId: string) {
  const key = `doexam.monitor.watch.${sessionId}`;
  const [list, setList] = useState<Picked[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(v) ? v.slice(0, MAX_WATCH) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* private mode: the list lives for this page only */
    }
  }, [key, list]);
  const ids = useMemo(() => new Set(list.map((p) => p.user_id)), [list]);
  return { list, ids, setList };
}

export function MonitorPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const session = useQuery({ queryKey: ['session', id], queryFn: () => sessionApi.get(id) });
  const watch = useWatchList(id);
  const [tab, setTab] = useState<Tab>(() => (watch.list.length ? 'watch' : 'violations'));
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [seat, setSeat] = useState('');
  const [q, setQ] = useState('');
  const [violationType, setViolationType] = useState('');
  const [watchFilter, setWatchFilter] = useState('');
  const dq = useDebounced(q);
  const dseat = useDebounced(seat);
  const [selected, setSelected] = useState<Map<string, Picked>>(new Map());
  const [announce, setAnnounce] = useState<'all' | 'selected' | null>(null);
  const announcements = useAnnouncements(id);
  const unreadImportant = useMemo(() => new Set(announcements.data?.unread_important ?? []), [announcements.data]);
  const [seenViolations, setSeenViolations] = useState<number | null>(null);

  const listQuery = { view: tab, page, per_page: PER_PAGE, group_id: groupId, seat: dseat.trim(), q: dq.trim(), violation_type: tab === 'violations' ? violationType : '' };
  const listed = useQuery({
    queryKey: ['monitor', id, 'list', listQuery],
    queryFn: () => sessionApi.monitorList(id, listQuery),
    enabled: tab !== 'watch',
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
  const watchIds = watch.list.map((p) => p.user_id);
  const watched = useQuery({
    queryKey: ['monitor', id, 'watch', watchIds],
    queryFn: () => sessionApi.monitorWatch(id, watchIds),
    enabled: tab === 'watch',
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
  const active = tab === 'watch' ? watched : listed;
  const m = tab === 'watch' ? watched.data : listed.data?.data;
  const counts = m?.counts ?? {};
  const serverNow = m ? Date.parse(m.server_time) : Date.now();

  // rows of this page: the server's page, or the filtered watch list cut into pages here
  const watchRows = useMemo(() => {
    const f = watchFilters.find((w) => w.v === watchFilter) ?? watchFilters[0];
    return (watched.data?.rows ?? []).filter(f.match);
  }, [watched.data, watchFilter]);
  const rows = tab === 'watch' ? watchRows.slice((page - 1) * PER_PAGE, page * PER_PAGE) : (listed.data?.data.rows ?? []);
  const total = tab === 'watch' ? watchRows.length : (listed.data?.total ?? 0);

  // a page can empty itself (a participant leaves the view): step back
  useEffect(() => {
    if (page > 1 && (tab === 'watch' ? watched.data : listed.data) && rows.length === 0) setPage(page - 1);
  }, [page, rows.length, tab, watched.data, listed.data]);
  // new violators since the proctor last looked at the Pelanggaran view
  const violations = counts.violations ?? 0;
  useEffect(() => {
    if (m && (tab === 'violations' || seenViolations === null)) setSeenViolations(violations);
  }, [m, tab, violations, seenViolations]);
  const newViolations = seenViolations !== null && tab !== 'violations' ? Math.max(0, violations - seenViolations) : 0;

  if (session.isLoading || !session.data) return <Loading />;
  const s = session.data;
  const canAnnounce = s.status === 'scheduled' || s.status === 'open' || s.status === 'paused';
  const go = (t: Tab) => {
    setTab(t);
    setPage(1);
  };
  const toggleWatch = (r: MonitorRow) => {
    if (watch.ids.has(r.user_id)) watch.setList((l) => l.filter((p) => p.user_id !== r.user_id));
    else if (watch.list.length >= MAX_WATCH) toast('error', 'Daftar pantauan penuh', `Maksimal ${MAX_WATCH} peserta. Lepas salah satu dulu.`);
    else watch.setList((l) => [...l, { user_id: r.user_id, full_name: r.full_name }]);
  };
  const toggleSelect = (r: MonitorRow) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(r.user_id)) next.delete(r.user_id);
      else next.set(r.user_id, { user_id: r.user_id, full_name: r.full_name });
      return next;
    });
  const allShown = rows.length > 0 && rows.every((r) => selected.has(r.user_id));
  const scoped = !!groupId || !!dseat.trim();

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
                <span className={cx('h-1.5 w-1.5 rounded-full', active.error ? 'bg-rose-500' : 'bg-emerald-500')} />
                Diperbarui {new Date(active.dataUpdatedAt).toLocaleTimeString('id-ID')}
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
            {canAnnounce && (
              <Button variant="secondary" icon={<Megaphone className="h-4 w-4" />} onClick={() => setAnnounce('all')}>
                Kirim pengumuman
              </Button>
            )}
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

      <div role="tablist" aria-label="Tampilan monitor" className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const n = t.v === 'watch' ? `${watch.list.length}/${MAX_WATCH}` : (counts[t.count] ?? 0);
          const hot = (t.v === 'violations' || t.v === 'idle') && Number(n) > 0 && tab !== t.v;
          return (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={tab === t.v}
              onClick={() => go(t.v)}
              className={cx(
                'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
                tab === t.v
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                hot && 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300',
              )}
            >
              {t.v === 'watch' ? <Eye className="h-3.5 w-3.5" /> : t.dot && <span className={cx('h-2 w-2 rounded-full', t.dot)} />}
              {t.label}
              <span className={cx('tabular-nums', tab === t.v ? 'opacity-70' : 'text-slate-500 dark:text-slate-400')}>{n}</span>
              {t.v === 'violations' && newViolations > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-px text-[10px] font-semibold text-white">+{newViolations} baru</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab === 'watch' ? (
          <div role="group" aria-label="Saring daftar pantauan" className="flex flex-wrap gap-1">
            {watchFilters.map((w) => (
              <button
                key={w.v}
                type="button"
                aria-pressed={watchFilter === w.v}
                onClick={() => {
                  setWatchFilter(w.v);
                  setPage(1);
                }}
                className={cx(
                  'h-7 rounded-md px-2.5 text-xs font-medium',
                  watchFilter === w.v ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <GroupSelect
              className="w-52"
              value={groupId}
              onChange={(v) => {
                setGroupId(v);
                setPage(1);
              }}
              emptyLabel="Semua grup"
            />
            <Input
              className="w-32"
              value={seat}
              onChange={(e) => {
                setSeat(e.target.value);
                setPage(1);
              }}
              placeholder="Awalan kursi"
              aria-label="Awalan kursi"
            />
            {tab === 'violations' && (
              <Select
                className="w-48"
                aria-label="Jenis pelanggaran"
                value={violationType}
                onChange={(e) => {
                  setViolationType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Semua jenis</option>
                {(Object.keys(violationLabel) as ViolationType[]).map((k) => (
                  <option key={k} value={k}>
                    {violationLabel[k]}
                  </option>
                ))}
              </Select>
            )}
            <div className="w-full sm:ml-auto sm:w-auto">
              <SearchInput
                value={q}
                onChange={(v) => {
                  setQ(v);
                  setPage(1);
                }}
                placeholder="Cari nama, username, kursi…"
              />
            </div>
          </>
        )}
      </div>
      {scoped && tab !== 'watch' && <p className="-mt-2 mb-3 text-[11px] text-slate-500">Angka di tab dihitung untuk grup/kursi yang dipilih.</p>}
      {active.error && <Alert className="mb-4">Gagal memuat monitor. Mencoba lagi…</Alert>}

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <span className="font-medium tabular-nums">{selected.size} peserta dipilih</span>
          {canAnnounce && (
            <Button size="sm" icon={<Megaphone className="h-3.5 w-3.5" />} onClick={() => setAnnounce('selected')}>
              Kirim pengumuman ke {selected.size} peserta
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setSelected(new Map())} className="ml-auto">
            Batal pilih
          </Button>
        </div>
      )}

      {!m ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={tab === 'watch' ? <Eye className="h-10 w-10" /> : undefined} title={emptyTitle(tab, watch.list.length)}>
          {tab === 'watch' && watch.list.length === 0 && 'Tambahkan peserta dengan tombol "Pantau" di tab Pelanggaran atau Semua peserta.'}
        </EmptyState>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              aria-label="Pilih semua kartu yang tampil"
              className="h-4 w-4 rounded border-slate-300"
              checked={allShown}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Map(prev);
                  for (const r of rows) {
                    if (allShown) next.delete(r.user_id);
                    else next.set(r.user_id, { user_id: r.user_id, full_name: r.full_name });
                  }
                  return next;
                })
              }
            />
            Pilih semua di halaman ini
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
            {rows.map((r) => (
              <MonitorCard
                key={r.user_id}
                row={r}
                serverNow={serverNow}
                sessionId={id}
                selected={selected.has(r.user_id)}
                onSelect={() => toggleSelect(r)}
                watched={watch.ids.has(r.user_id)}
                onWatch={() => toggleWatch(r)}
                unreadImportant={unreadImportant.has(r.user_id)}
              />
            ))}
          </div>
        </>
      )}
      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />
      <AnnouncementHistory sessionId={id} />
      {announce && (
        <AnnounceDialog
          sessionId={id}
          to={announce === 'selected' ? [...selected.values()] : undefined}
          onClose={() => setAnnounce(null)}
          onSent={() => announce === 'selected' && setSelected(new Map())}
        />
      )}
    </>
  );
}

function emptyTitle(tab: Tab, watching: number) {
  if (tab === 'watch') return watching ? 'Tidak ada peserta dipantau yang cocok' : 'Belum ada peserta yang dipantau';
  return {
    violations: 'Tidak ada pelanggaran',
    idle: 'Semua peserta aktif',
    locked: 'Tidak ada peserta yang dikunci',
    not_started: 'Semua peserta sudah mulai',
    in_progress: 'Tidak ada yang sedang mengerjakan',
    submitted: 'Belum ada yang mengumpulkan',
    all: 'Tidak ada peserta yang cocok',
  }[tab];
}

function ago(iso: string | null | undefined, now: number) {
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

type ActionKind = 'extend' | 'lock' | 'unlock' | 'reset' | 'plays' | 'submit';

function MonitorCard({
  row: r,
  serverNow,
  sessionId,
  selected,
  onSelect,
  watched,
  onWatch,
  unreadImportant,
}: {
  row: MonitorRow;
  serverNow: number;
  sessionId: string;
  selected: boolean;
  onSelect: () => void;
  watched: boolean;
  onWatch: () => void;
  unreadImportant: boolean;
}) {
  const can = useCan();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [minutes, setMinutes] = useState('10');
  const idle = !!r.idle;
  const pct = r.item_count ? Math.round((r.answered / r.item_count) * 100) : 0;
  const left = r.deadline_at && r.status === 'in_progress' ? Math.max(0, (Date.parse(r.deadline_at) - serverNow) / 1000) : null;
  const run = useAction(
    async (k: ActionKind) => {
      const id = r.attempt_id!;
      if (k === 'extend') return attemptApi.extend(id, Number(minutes));
      if (k === 'lock') return attemptApi.lock(id);
      if (k === 'unlock') return attemptApi.unlock(id);
      if (k === 'reset') return attemptApi.resetDevice(id);
      if (k === 'plays') return attemptApi.grantPlays(id, 1);
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
  const running = r.status === 'in_progress' || r.status === 'locked';
  const acts: { k: ActionKind; label: string; icon: React.ReactNode; show: boolean }[] = [
    { k: 'extend', label: 'Tambah waktu', icon: <Clock className="h-3.5 w-3.5" />, show: running },
    { k: 'lock', label: 'Kunci', icon: <Lock className="h-3.5 w-3.5" />, show: r.status === 'in_progress' },
    { k: 'unlock', label: 'Buka kunci', icon: <Unlock className="h-3.5 w-3.5" />, show: r.status === 'locked' },
    { k: 'reset', label: 'Reset perangkat', icon: <MonitorSmartphone className="h-3.5 w-3.5" />, show: r.device_bound && running },
    { k: 'plays', label: 'Tambah 1× putar audio', icon: <AudioLines className="h-3.5 w-3.5" />, show: running },
    { k: 'submit', label: 'Kumpulkan paksa', icon: <Send className="h-3.5 w-3.5" />, show: running },
  ];
  const shown = acts.filter((a) => a.show);
  const texts: Record<ActionKind, string> = {
    extend: 'Waktu peserta ditambah (tidak bisa melewati akhir sesi).',
    lock: 'Peserta tidak bisa menjawab sampai dibuka kembali.',
    unlock: 'Peserta bisa melanjutkan ujian.',
    reset: 'Peserta bisa melanjutkan di perangkat lain (mis. PC rusak).',
    plays: 'Setiap audio yang dibatasi bisa diputar 1 kali lagi oleh peserta ini, mis. bila speaker atau headset bermasalah. Tercatat di log.',
    submit: 'Jawaban peserta dikumpulkan sekarang dan dinilai. Tidak bisa dibatalkan.',
  };
  const kinds = (Object.keys(violationLabel) as ViolationType[]).filter((k) => (r.violation_counts?.[k] ?? 0) > 0);
  const edge = selected
    ? 'border-blue-400 ring-2 ring-blue-500/20 dark:border-blue-600'
    : idle || r.violations > 2
      ? 'border-rose-300 dark:border-rose-800'
      : r.violations > 0 || r.status === 'locked'
        ? 'border-amber-300 dark:border-amber-800'
        : 'border-slate-200 dark:border-slate-800';
  return (
    <article aria-label={r.full_name} className={cx('relative flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-xs dark:bg-slate-900', edge)}>
      <div className="flex items-start gap-2">
        <input type="checkbox" aria-label={`Pilih ${r.full_name}`} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" checked={selected} onChange={onSelect} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-xs font-semibold text-slate-900 dark:text-white" title={r.full_name}>
            {r.full_name}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{r.seat ?? '—'}</span> · {r.username}
          </p>
        </div>
        <button
          type="button"
          onClick={onWatch}
          aria-pressed={watched}
          title={watched ? 'Lepas dari daftar pantauan' : 'Pantau'}
          aria-label={watched ? `Lepas ${r.full_name} dari pantauan` : `Pantau ${r.full_name}`}
          className={cx(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            watched ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white',
          )}
        >
          {watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {shown.length > 0 && (
          <button
            type="button"
            aria-expanded={menu}
            onClick={() => setMenu((x) => !x)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={`Tindakan untuk ${r.full_name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {r.status ? <Badge tone={statusTone[r.status]}>{labels.attemptStatus[r.status]}</Badge> : <Badge>{labels.attendance[r.attendance] ?? 'Belum mulai'}</Badge>}
        {r.violations > 0 && (
          <Badge tone={r.violations > 2 ? 'red' : 'amber'}>
            <AlertTriangle className="h-3 w-3" /> {r.violations}
          </Badge>
        )}
        {unreadImportant && (
          <span title="Belum mengonfirmasi pengumuman penting lebih dari 1 menit" className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Megaphone className="h-3 w-3" /> Belum baca
          </span>
        )}
        {left !== null && <span className="ml-auto text-[11px] tabular-nums text-slate-600 dark:text-slate-300">{formatClock(left)}</span>}
        {r.final_score !== null && (r.status === 'submitted' || r.status === 'graded') && <span className="ml-auto text-[11px] tabular-nums text-slate-500">Nilai {r.final_score}</span>}
      </div>
      {r.status && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-slate-500">
            {r.answered}/{r.item_count} dijawab
          </p>
        </div>
      )}
      {kinds.length > 0 && (
        <p className="text-[11px] text-rose-700 dark:text-rose-400">
          {kinds.map((k) => `${violationLabel[k]} ×${r.violation_counts![k]}`).join(' · ')}
          {r.last_violation_at && <span className="text-slate-500"> · terakhir {ago(r.last_violation_at, serverNow)}</span>}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 text-[11px]">
        <span className={cx('inline-flex items-center gap-1', idle ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-slate-500')}>
          {idle && <WifiOff className="h-3 w-3" />}
          {r.status === 'locked' && r.locked_at ? `Dikunci ${ago(r.locked_at, serverNow)}` : r.status ? `Aktif ${ago(r.last_seen_at, serverNow)}` : 'Belum mulai'}
        </span>
        {r.attempt_id && (r.status === 'submitted' || r.status === 'graded') && can(Perm.ReportRead, Perm.TenantManage, Perm.GradeWrite) && (
          <Link to={`/reports/attempts/${r.attempt_id}`} className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <FileBarChart className="h-3.5 w-3.5" /> Laporan
          </Link>
        )}
      </div>
      {menu && (
        <div className="absolute right-2 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg dark:border-slate-700 dark:bg-slate-800" onMouseLeave={() => setMenu(false)}>
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
    </article>
  );
}
