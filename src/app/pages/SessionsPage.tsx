import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Megaphone, MonitorPlay, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Session, SessionStatus } from '@/shared/api/types';
import { formatDateTime, formatTime, fromLocalInput, labels, toLocalInput } from '@/shared/lib/format';
import { Badge, Button, Checkbox, EmptyState, Field, Input, Loading, Modal, PageHeader, Pagination, Select, Table, td, th } from '@/shared/ui';
import { sessionApi } from '../api';
import { AnnounceDialog } from '../components/Announcements';
import { useAction, usePaging } from '../components/hooks';
import { ExamSelect } from '../components/pickers';
import { Perm, useCan } from '../perm';

export const sessionTone: Record<SessionStatus, 'slate' | 'green' | 'amber' | 'red'> = {
  scheduled: 'slate',
  open: 'green',
  paused: 'amber',
  closed: 'slate',
  cancelled: 'red',
};

export function SessionsPage() {
  const can = useCan();
  const { page, setPage, filters, setFilter, query } = usePaging({ status: '' });
  const list = useQuery({ queryKey: ['sessions', query], queryFn: () => sessionApi.list(query), refetchInterval: 30_000 });
  const [creating, setCreating] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  return (
    <>
      <PageHeader
        title="Sesi ujian"
        subtitle={can(Perm.SessionManage) ? 'Jadwal pelaksanaan ujian per ruang/kelompok.' : 'Sesi yang ditugaskan kepada Anda.'}
        actions={
          can(Perm.SessionManage) && (
            <>
              <Button variant="secondary" icon={<Megaphone className="h-4 w-4" />} onClick={() => setBroadcasting(true)}>
                Umumkan ke sesi berlangsung
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                Sesi baru
              </Button>
            </>
          )
        }
      />
      {broadcasting && <AnnounceDialog broadcast onClose={() => setBroadcasting(false)} />}
      <div className="mb-4">
        <Select className="w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(labels.sessionStatus).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="Belum ada sesi" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Sesi</th>
                <th className={th}>Waktu</th>
                <th className={th}>Ruang</th>
                <th className={th}>Peserta</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={td}>
                    <Link to={`/sessions/${s.id}`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-white">
                      {s.name}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {s.exam_title}
                      {s.is_makeup && ' · susulan'}
                    </p>
                  </td>
                  <td className={td}>
                    {formatDateTime(s.starts_at)} – {formatTime(s.ends_at)}
                  </td>
                  <td className={td}>{s.room ?? '—'}</td>
                  <td className={td}>{s.participant_count}</td>
                  <td className={td}>
                    <Badge tone={sessionTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
                  </td>
                  <td className={`${td} text-right`}>
                    <Link to={`/sessions/${s.id}/monitor`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      <MonitorPlay className="h-3.5 w-3.5" /> Monitor
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={list.data.perPage} total={list.data.total} onPage={setPage} />
        </>
      )}
      {creating && <SessionForm session={null} onClose={() => setCreating(false)} />}
    </>
  );
}

export function SessionForm({ session, onClose, onSaved }: { session: Session | null; onClose: () => void; onSaved?: (s: Session) => void }) {
  const navigate = useNavigate();
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const [f, setF] = useState({
    exam_id: session?.exam.id ?? '',
    name: session?.name ?? '',
    room: session?.room ?? '',
    starts_at: toLocalInput(session?.starts_at ?? now.toISOString()),
    ends_at: toLocalInput(session?.ends_at ?? new Date(now.getTime() + 2 * 3600_000).toISOString()),
    late: session?.late_entry_minutes === null || session?.late_entry_minutes === undefined ? '' : String(session.late_entry_minutes),
    token_required: session?.token_required ?? true,
    rotation: String(session?.token_rotation_minutes ?? 15),
    is_makeup: session?.is_makeup ?? false,
    require_camera: session?.require_camera ?? false,
    require_screen: session?.require_screen ?? false,
  });
  // a running session only accepts these fields (the server answers 409 otherwise)
  const running = session?.status === 'open' || session?.status === 'paused';
  const body = {
    ...(session ? {} : { exam_id: f.exam_id }),
    name: f.name,
    room: f.room,
    ends_at: fromLocalInput(f.ends_at),
    late_entry_minutes: f.late === '' ? null : Number(f.late),
    token_required: f.token_required,
    token_rotation_minutes: Number(f.rotation),
    ...(running
      ? {}
      : { starts_at: fromLocalInput(f.starts_at), is_makeup: f.is_makeup, require_camera: f.require_camera, require_screen: f.require_screen }),
  };
  const save = useAction(() => (session ? sessionApi.update(session.id, body) : sessionApi.create(body)), {
    success: 'Sesi disimpan',
    invalidate: [['sessions'], ['session']],
    toastErrors: false,
    onSuccess: (s) => {
      onClose();
      if (onSaved) onSaved(s);
      else navigate(`/sessions/${s.id}`);
    },
  });
  const fe = save.fields;
  return (
    <Modal
      open
      onClose={onClose}
      title={session ? 'Ubah sesi' : 'Sesi baru'}
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
        {!session && (
          <Field label="Ujian" error={fe.exam_id} hint="Hanya ujian yang sudah terbit.">
            <ExamSelect value={f.exam_id} onChange={(id) => setF({ ...f, exam_id: id })} status="published" invalid={!!fe.exam_id} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama sesi" error={fe.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sesi 1 — Lab A" />
          </Field>
          <Field label="Ruang" error={fe.room}>
            <Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="Lab Komputer 1" />
          </Field>
          <Field label="Mulai" error={fe.starts_at}>
            <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} disabled={running} />
          </Field>
          <Field label="Selesai" error={fe.ends_at}>
            <Input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
          </Field>
          <Field label="Batas terlambat (menit)" error={fe.late_entry_minutes} hint="Kosong = boleh masuk kapan saja selama sesi.">
            <Input type="number" value={f.late} onChange={(e) => setF({ ...f, late: e.target.value })} />
          </Field>
          <Field label="Rotasi token (menit)" error={fe.token_rotation_minutes}>
            <Input type="number" value={f.rotation} onChange={(e) => setF({ ...f, rotation: e.target.value })} disabled={!f.token_required} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Wajib token ruang" checked={f.token_required} onChange={(e) => setF({ ...f, token_required: e.target.checked })} />
          {!session && <Checkbox label="Sesi susulan" checked={f.is_makeup} onChange={(e) => setF({ ...f, is_makeup: e.target.checked })} />}
        </div>
        <fieldset className="space-y-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Pengawasan kamera &amp; layar</legend>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="Wajibkan kamera"
              checked={f.require_camera}
              disabled={running}
              onChange={(e) => setF({ ...f, require_camera: e.target.checked })}
            />
            <Checkbox
              label="Wajibkan berbagi seluruh layar"
              checked={f.require_screen}
              disabled={running}
              onChange={(e) => setF({ ...f, require_screen: e.target.checked })}
            />
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {running
              ? 'Tidak bisa diubah selama sesi berjalan.'
              : 'Peserta harus menyalakan kamera dan/atau membagikan seluruh layar sebelum mulai. Pengawas bisa melihatnya kapan saja dari monitor; video hanya dikirim saat dilihat dan tidak direkam.'}
          </p>
          {(f.require_camera || f.require_screen) && !running && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700 marker:text-amber-400 dark:text-amber-300">
              <li>Server harus dibuka lewat HTTPS (lihat panduan <code>doexam tls init</code>).</li>
              {f.require_screen && <li>Berbagi layar hanya bisa di browser komputer (Chrome/Edge disarankan); peserta dari HP tidak bisa mulai.</li>}
            </ul>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
