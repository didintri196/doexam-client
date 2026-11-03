import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, MonitorPlay, Pause, Pencil, Play, Plus, RotateCw, Square, Trash2, Tv2, UserMinus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Attendance, Group, Participant, Session, SessionStatus, User } from '@/shared/api/types';
import { formatClock, formatDateTime, formatTime, labels } from '@/shared/lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Tabs, td, th } from '@/shared/ui';
import { sessionApi } from '../api';
import { useAction } from '../components/hooks';
import { GroupPicker, SearchInput, useDebounced, UserPicker } from '../components/pickers';
import { Perm, useCan } from '../perm';
import { SessionForm, sessionTone } from './SessionsPage';

const transitions: Record<SessionStatus, { to: SessionStatus; label: string; icon: React.ReactNode; tone: 'success' | 'warning' | 'secondary' | 'danger' }[]> = {
  scheduled: [
    { to: 'open', label: 'Buka sesi', icon: <Play className="h-4 w-4" />, tone: 'success' },
    { to: 'cancelled', label: 'Batalkan', icon: <Ban className="h-4 w-4" />, tone: 'secondary' },
  ],
  open: [
    { to: 'paused', label: 'Jeda', icon: <Pause className="h-4 w-4" />, tone: 'warning' },
    { to: 'closed', label: 'Tutup sesi', icon: <Square className="h-4 w-4" />, tone: 'danger' },
  ],
  paused: [
    { to: 'open', label: 'Lanjutkan', icon: <Play className="h-4 w-4" />, tone: 'success' },
    { to: 'closed', label: 'Tutup sesi', icon: <Square className="h-4 w-4" />, tone: 'danger' },
  ],
  closed: [],
  cancelled: [],
};

const confirmText: Partial<Record<SessionStatus, string>> = {
  closed: 'Semua peserta yang masih mengerjakan akan dikumpulkan otomatis. Sesi tidak bisa dibuka lagi.',
  cancelled: 'Sesi dibatalkan dan tidak bisa dibuka.',
  paused: 'Peserta tidak bisa memulai ujian baru selama sesi dijeda. Yang sedang mengerjakan tetap berjalan.',
  open: 'Peserta bisa mulai mengerjakan (dengan token bila diwajibkan).',
};

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const can = useCan();
  const session = useQuery({ queryKey: ['session', id], queryFn: () => sessionApi.get(id), refetchInterval: 30_000 });
  const [tab, setTab] = useState<'participants' | 'proctors'>('participants');
  const [target, setTarget] = useState<SessionStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setSession = (s: Session) => qc.setQueryData(['session', id], s);
  const status = useAction((to: SessionStatus) => sessionApi.setStatus(id, to), {
    success: (s) => `Sesi ${labels.sessionStatus[s.status].toLowerCase()}`,
    invalidate: [['sessions']],
    onSuccess: (s) => (setSession(s), setTarget(null)),
  });
  const remove = useAction(() => sessionApi.remove(id), { success: 'Sesi dihapus', invalidate: [['sessions']], onSuccess: () => navigate('/sessions') });
  if (session.isLoading || !session.data) return <Loading />;
  const s = session.data;
  const manager = s.my_role === 'manager';

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={sessionTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
            <span>
              {s.exam.title} · {formatDateTime(s.starts_at)} – {formatTime(s.ends_at)}
              {s.room && ` · ${s.room}`}
            </span>
          </span>
        }
        back={
          <Link to="/sessions" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Sesi ujian
          </Link>
        }
        actions={
          <>
            {transitions[s.status]
              .filter((t) => manager || t.to !== 'cancelled')
              .map((t) => (
                <Button key={t.to} variant={t.tone} icon={t.icon} onClick={() => setTarget(t.to)}>
                  {t.label}
                </Button>
              ))}
            <Link to={`/sessions/${id}/monitor`}>
              <Button variant="secondary" icon={<MonitorPlay className="h-4 w-4" />}>
                Monitor
              </Button>
            </Link>
            {manager && s.status !== 'closed' && s.status !== 'cancelled' && (
              <IconButton label="Ubah sesi" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </IconButton>
            )}
            {manager && s.status === 'scheduled' && (
              <IconButton label="Hapus sesi" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4 text-rose-600" />
              </IconButton>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <TokenCard session={s} />
        <Card title="Kehadiran" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MiniStat label="Peserta" value={s.participant_count} />
            {(['present', 'expected', 'absent', 'excused'] as Attendance[]).map((a) => (
              <MiniStat key={a} label={labels.attendance[a]} value={s.attendance[a] ?? 0} />
            ))}
          </div>
          {s.groups.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {s.groups.map((g) => (
                <Badge key={g.id} tone="purple">
                  {g.name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'participants', label: 'Peserta' }, { value: 'proctors', label: `Pengawas (${s.proctors.length})` }]} />
      {tab === 'participants' ? <Participants session={s} canManage={can(Perm.SessionManage)} /> : <Proctors session={s} manager={manager} onSession={setSession} />}

      {target && (
        <ConfirmDialog
          open
          title={transitions[s.status].find((t) => t.to === target)?.label ?? ''}
          tone={target === 'closed' || target === 'cancelled' ? 'danger' : 'primary'}
          loading={status.isPending}
          onClose={() => setTarget(null)}
          onConfirm={() => status.mutate(target)}
        >
          {confirmText[target]}
        </ConfirmDialog>
      )}
      {editing && <SessionForm session={s} onClose={() => setEditing(false)} onSaved={setSession} />}
      <ConfirmDialog open={deleting} title="Hapus sesi?" tone="danger" confirmLabel="Hapus" loading={remove.isPending} onClose={() => setDeleting(false)} onConfirm={() => remove.mutate(undefined)}>
        Hanya sesi terjadwal yang belum dikerjakan siapa pun yang bisa dihapus.
      </ConfirmDialog>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/** useToken keeps the room token fresh: it refetches when the code expires. */
export function useToken(session: Session) {
  const enabled = session.token_required && (session.status === 'open' || session.status === 'paused' || session.status === 'scheduled');
  const token = useQuery({
    queryKey: ['session', session.id, 'token'],
    queryFn: () => sessionApi.token(session.id),
    enabled,
    refetchInterval: (q) => (q.state.data ? Math.max(1000, Date.parse(q.state.data.expires_at) - Date.now() + 500) : 30_000),
    gcTime: 0,
  });
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = token.data ? Math.max(0, (Date.parse(token.data.expires_at) - Date.now()) / 1000) : 0;
  return { token, left, enabled };
}

function TokenCard({ session }: { session: Session }) {
  const { token, left, enabled } = useToken(session);
  const qc = useQueryClient();
  const rotate = useAction(() => sessionApi.rotateToken(session.id), {
    success: 'Token baru dibuat; token lama tidak berlaku',
    onSuccess: (t) => qc.setQueryData(['session', session.id, 'token'], t),
  });
  return (
    <Card
      title="Token ruang"
      actions={
        enabled && (
          <>
            <a href={`/app/sessions/${session.id}/board`} target="_blank" rel="noreferrer">
              <IconButton label="Layar proyektor">
                <Tv2 className="h-4 w-4" />
              </IconButton>
            </a>
            <IconButton label="Ganti token" onClick={() => rotate.mutate(undefined)}>
              <RotateCw className="h-4 w-4" />
            </IconButton>
          </>
        )
      }
    >
      {!session.token_required ? (
        <p className="text-xs text-slate-500">Sesi ini tidak memakai token.</p>
      ) : !enabled ? (
        <p className="text-xs text-slate-500">Token tidak aktif.</p>
      ) : token.data ? (
        <div className="text-center">
          <p className="font-mono text-4xl font-extrabold tracking-[0.3em] text-blue-600">{token.data.code}</p>
          <p className="mt-1 text-[11px] text-slate-500">berganti dalam {formatClock(left)} · tiap {token.data.rotation_minutes} menit</p>
        </div>
      ) : (
        <Loading />
      )}
    </Card>
  );
}

function Proctors({ session, manager, onSession }: { session: Session; manager: boolean; onSession: (s: Session) => void }) {
  const [picked, setPicked] = useState<User[]>([]);
  const save = useAction((ids: string[]) => sessionApi.setProctors(session.id, ids), { success: 'Pengawas disimpan', onSuccess: (s) => (onSession(s), setPicked([])) });
  const ids = session.proctors.map((p) => p.user_id);
  return (
    <div className="space-y-4">
      {manager && (
        <Card title="Tugaskan pengawas">
          <UserPicker selected={picked} onChange={setPicked} placeholder="Cari guru / pengawas…" />
          {picked.length > 0 && (
            <Button className="mt-2" loading={save.isPending} onClick={() => save.mutate([...new Set([...ids, ...picked.map((u) => u.id)])])}>
              Tambahkan {picked.length}
            </Button>
          )}
        </Card>
      )}
      {session.proctors.length === 0 ? (
        <EmptyState title="Belum ada pengawas" />
      ) : (
        <Table>
          <tbody>
            {session.proctors.map((p) => (
              <tr key={p.user_id}>
                <td className={td}>
                  <p className="font-semibold">{p.full_name}</p>
                  <p className="font-mono text-[11px] text-slate-500">{p.username}</p>
                </td>
                <td className={`${td} text-right`}>
                  {manager && (
                    <IconButton label="Lepas" onClick={() => save.mutate(ids.filter((x) => x !== p.user_id))}>
                      <UserMinus className="h-3.5 w-3.5 text-rose-600" />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Participants({ session, canManage }: { session: Session; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [attendance, setAttendance] = useState('');
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ['session', session.id, 'participants', page, dq, attendance],
    queryFn: () => sessionApi.participants(session.id, { page, per_page: 25, q: dq, attendance }),
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const inv = [['session']];
  const update = useAction((a: { user: string; body: Parameters<typeof sessionApi.updateParticipant>[2] }) => sessionApi.updateParticipant(session.id, a.user, a.body), { invalidate: inv });
  const remove = useAction((user: string) => sessionApi.removeParticipant(session.id, user), { success: 'Peserta dikeluarkan', invalidate: inv });
  const editable = session.status !== 'closed' && session.status !== 'cancelled';
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} />
          <Select className="w-auto" value={attendance} onChange={(e) => (setAttendance(e.target.value), setPage(1))}>
            <option value="">Semua kehadiran</option>
            {Object.entries(labels.attendance).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {canManage && editable && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Tambah peserta
          </Button>
        )}
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState title="Belum ada peserta" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Peserta</th>
                <th className={th}>Kehadiran</th>
                <th className={th}>Kursi</th>
                <th className={th}>Waktu tambahan</th>
                <th className={th}>Catatan</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((p) => (
                <tr key={p.user_id}>
                  <td className={td}>
                    <p className="font-semibold">{p.full_name}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {p.username}
                      {p.external_id && ` · ${p.external_id}`}
                    </p>
                  </td>
                  <td className={td}>
                    {editable ? (
                      <Select className="w-auto" value={p.attendance} onChange={(e) => update.mutate({ user: p.user_id, body: { attendance: e.target.value as Attendance } })}>
                        {Object.entries(labels.attendance).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      labels.attendance[p.attendance]
                    )}
                  </td>
                  <td className={td}>{p.seat ?? '—'}</td>
                  <td className={td}>{p.extra_time_minutes ? <Badge tone="purple">+{p.extra_time_minutes} mnt</Badge> : '—'}</td>
                  <td className={`${td} max-w-48 truncate`}>{p.notes ?? '—'}</td>
                  <td className={`${td} text-right`}>
                    {editable && (
                      <div className="flex justify-end gap-1">
                        <IconButton label="Ubah" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </IconButton>
                        {canManage && (
                          <IconButton label="Keluarkan" onClick={() => remove.mutate(p.user_id)}>
                            <UserMinus className="h-3.5 w-3.5 text-rose-600" />
                          </IconButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={25} total={list.data.total} onPage={setPage} />
        </>
      )}
      {adding && <AddParticipants session={session} onClose={() => setAdding(false)} />}
      {editing && <EditParticipant session={session} participant={editing} canManage={canManage} onClose={() => setEditing(null)} />}
    </>
  );
}

function AddParticipants({ session, onClose }: { session: Session; onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [extra, setExtra] = useState('');
  const add = useAction(
    () => sessionApi.addParticipants(session.id, { user_ids: users.map((u) => u.id), group_ids: groups.map((g) => g.id), extra_time_minutes: extra ? Number(extra) : 0 }),
    { success: (r) => `${r.added} peserta ditambahkan${r.skipped ? `, ${r.skipped} sudah terdaftar` : ''}`, invalidate: [['session'], ['sessions']], onSuccess: onClose },
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Tambah peserta"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!users.length && !groups.length} loading={add.isPending} onClick={() => add.mutate(undefined)}>
            Tambahkan
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Dari kelas / grup" hint="Semua anggota grup ditambahkan (wali kelas tidak).">
          <GroupPicker selected={groups} onChange={setGroups} />
        </Field>
        <Field label="Perorangan">
          <UserPicker selected={users} onChange={setUsers} role="participant" />
        </Field>
        <Field label="Waktu tambahan (menit)" hint="Untuk akomodasi khusus; bisa juga diatur per peserta.">
          <Input type="number" className="w-32" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function EditParticipant({ session, participant: p, canManage, onClose }: { session: Session; participant: Participant; canManage: boolean; onClose: () => void }) {
  const [f, setF] = useState({ seat: p.seat ?? '', notes: p.notes ?? '', extra: String(p.extra_time_minutes) });
  const save = useAction(
    () =>
      sessionApi.updateParticipant(session.id, p.user_id, {
        seat: f.seat,
        notes: f.notes,
        ...(canManage ? { extra_time_minutes: Number(f.extra || 0) } : {}),
      }),
    { success: 'Peserta diperbarui', invalidate: [['session']], toastErrors: false, onSuccess: onClose },
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={p.full_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Kursi / PC" error={save.fields.seat}>
          <Input value={f.seat} onChange={(e) => setF({ ...f, seat: e.target.value })} />
        </Field>
        {canManage && (
          <Field label="Waktu tambahan (menit)" error={save.fields.extra_time_minutes}>
            <Input type="number" value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} />
          </Field>
        )}
        <Field label="Catatan" error={save.fields.notes}>
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
