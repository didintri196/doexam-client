import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Clock, DoorOpen, KeyRound, MapPin, PlayCircle, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { MyAnnouncements, MySession } from '@/shared/api/types';
import { useAuth } from '@/shared/auth/auth';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { formatDateTime, formatTime, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader } from '@/shared/ui';
import { examApi } from '../api';
import { AnnouncementInbox, AnnouncementLayer } from '../Announcements';
import { Shell } from '../Shell';

const statusTone = { scheduled: 'slate', open: 'green', paused: 'amber', closed: 'slate', cancelled: 'red' } as const;

export function SessionsPage() {
  const { me } = useAuth();
  const sessions = useQuery({ queryKey: ['my-sessions'], queryFn: examApi.mySessions, refetchInterval: 30_000 });
  const attempts = useQuery({ queryKey: ['my-attempts'], queryFn: examApi.myAttempts });
  const navigate = useNavigate();
  const [starting, setStarting] = useState<MySession | null>(null);

  const running = (attempts.data ?? []).filter((a) => a.status === 'in_progress' || a.status === 'locked');
  const list = [...(sessions.data ?? [])].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const announcements = useSessionAnnouncements(list);

  return (
    <Shell>
      <PageHeader
        title={`Halo, ${me?.full_name ?? 'Peserta'}`}
        subtitle="Ujian yang dijadwalkan untuk Anda. Tombol mulai aktif setelah pengawas membuka sesi."
        actions={
          <div className="flex items-center gap-2">
            <AnnouncementInbox items={announcements.items} onConfirm={announcements.confirm} />
            <Button variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void sessions.refetch()} loading={sessions.isFetching}>
              Muat ulang
            </Button>
          </div>
        }
      />
      <AnnouncementLayer items={announcements.items} onConfirm={announcements.confirm} className="mb-5 !px-0" />

      {running.length > 0 && (
        <div className="mb-5 space-y-2">
          {running.map((a) => (
            <Alert key={a.id} tone="blue" className="items-center">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Anda punya ujian yang sedang berjalan: <strong>{a.exam_title}</strong>.
                </span>
                <Button size="sm" icon={<PlayCircle className="h-4 w-4" />} onClick={() => navigate(`/attempt/${a.id}`)}>
                  Lanjutkan
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {sessions.isLoading ? (
        <Loading />
      ) : sessions.error ? (
        <Alert>{errorMessage(sessions.error)}</Alert>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarClock />} title="Belum ada jadwal ujian">
            Jadwal muncul di sini setelah Anda didaftarkan ke sesi ujian.
          </EmptyState>
        </Card>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {list.map((s) => {
            const open = s.status === 'open';
            const minutes = (s.total_minutes ?? 0) + s.extra_time_minutes;
            return (
              <li key={s.session_id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{s.exam_title}</h2>
                    <Badge tone={statusTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.name}</p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> {formatDateTime(s.starts_at)} – {formatTime(s.ends_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {minutes ? `${minutes} menit` : 'Tanpa batas waktu'}
                      {s.extra_time_minutes > 0 && <Badge tone="blue">+{s.extra_time_minutes} mnt</Badge>}
                    </span>
                    {s.room && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" /> {s.room}
                      </span>
                    )}
                    {s.seat && (
                      <span className="flex items-center gap-1.5">
                        <DoorOpen className="h-3.5 w-3.5 text-slate-400" /> Kursi {s.seat}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  variant={open ? 'primary' : 'secondary'}
                  className="sm:w-auto"
                  disabled={!open}
                  onClick={() => setStarting(s)}
                  icon={open ? (s.token_required ? <KeyRound className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />) : undefined}
                >
                  {open ? 'Mulai ujian' : s.status === 'scheduled' ? 'Menunggu pengawas' : labels.sessionStatus[s.status]}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {starting && <StartModal session={starting} onClose={() => setStarting(null)} />}
    </Shell>
  );
}

const announceKey = (sessionId: string) => ['my-announcements', sessionId];

/**
 * useSessionAnnouncements polls announcements of the sessions that have not ended yet
 * (every 30 s while the page is open). Before an attempt exists, confirmations go
 * straight to the server; inside the exam they travel through the attempt outbox.
 */
function useSessionAnnouncements(sessions: MySession[]) {
  const qc = useQueryClient();
  const live = sessions.filter((s) => s.status === 'scheduled' || s.status === 'open' || s.status === 'paused');
  const results = useQueries({
    queries: live.map((s) => ({
      queryKey: announceKey(s.session_id),
      queryFn: () => examApi.announcements(s.session_id),
      refetchInterval: 30_000,
    })),
  });
  const items = results
    .flatMap((r) => r.data?.announcements ?? [])
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const confirm = (id: string) => {
    const a = items.find((x) => x.id === id);
    if (!a) return;
    const at = new Date().toISOString();
    qc.setQueryData<MyAnnouncements>(announceKey(a.session_id), (old) =>
      old ? { ...old, announcements: old.announcements.map((x) => (x.id === id ? { ...x, read_at: at } : x)) } : old,
    );
    // a failed confirmation shows the announcement again on the next poll
    void examApi.readAnnouncement(id).catch(() => void qc.invalidateQueries({ queryKey: announceKey(a.session_id) }));
  };
  return { items, confirm };
}

function StartModal({ session, onClose }: { session: MySession; onClose: () => void }) {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const start = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const view = await examApi.start(session.session_id, session.token_required ? token.trim().toUpperCase() : undefined);
      navigate(`/attempt/${view.id}`, { state: { view } });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Mulai ujian"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => void start()} loading={busy} disabled={session.token_required && token.trim().length < 6}>
            Mulai sekarang
          </Button>
        </>
      }
    >
      <form onSubmit={start} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          <p className="font-semibold text-slate-900 dark:text-white">{session.exam_title}</p>
          <p className="text-slate-500 dark:text-slate-400">{session.name}</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 marker:text-slate-300 dark:text-slate-300">
          <li>Waktu berjalan sejak Anda menekan Mulai dan mengikuti jam server.</li>
          <li>Jawaban tersimpan otomatis, juga saat jaringan terputus.</li>
          <li>Berpindah tab atau keluar layar penuh tercatat oleh pengawas.</li>
        </ul>
        {session.token_required && (
          <Field label="Token ruang" error={fields.token} hint="Lihat token di layar pengawas.">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              autoComplete="off"
              className="h-12 text-center font-mono text-xl font-semibold tracking-[0.4em] uppercase"
            />
          </Field>
        )}
        {error && !fields.token && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
