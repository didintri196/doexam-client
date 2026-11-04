import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Undo2, Users } from 'lucide-react';
import { useState } from 'react';
import type { AnnouncementPriority } from '@/shared/api/types';
import { useAuth } from '@/shared/auth/auth';
import { formatTime } from '@/shared/lib/format';
import { Badge, Button, Card, ConfirmDialog, cx, Field, Loading, Modal, Textarea } from '@/shared/ui';
import { sessionApi } from '../api';
import { Perm, useCan } from '../perm';
import { useAction } from './hooks';

// Announcements to session participants (DOCS/PLAN/12-PENGUMUMAN-PESERTA.md).
// Participants receive them with their next heartbeat, at most about 15 seconds later.

const MAX_LEN = 500;

/** Ready-made texts; kept in the client, still editable before sending. */
const templates = [
  'Waktu tersisa 10 menit.',
  'Periksa kembali jawaban sebelum mengumpulkan.',
  'Harap tenang, ujian sedang berlangsung.',
  'Jaringan sedang diperbaiki. Jawaban tetap tersimpan, lanjutkan mengerjakan.',
];

export const announcementsKey = (sessionId: string) => ['announcements', sessionId];

/** useAnnouncements polls a session's announcement history with read counts. */
export function useAnnouncements(sessionId: string) {
  return useQuery({ queryKey: announcementsKey(sessionId), queryFn: () => sessionApi.announcements(sessionId), refetchInterval: 10_000 });
}

/**
 * AnnounceDialog writes an announcement. `to` limits it to some participants; without it
 * every participant of the session (or of every running session, with `broadcast`) gets it.
 */
export function AnnounceDialog({
  sessionId,
  to,
  broadcast,
  onClose,
  onSent,
}: {
  sessionId?: string;
  to?: { user_id: string; full_name: string }[];
  broadcast?: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('info');
  const send = useAction(
    async () => {
      if (broadcast) {
        const r = await sessionApi.broadcastRunning(body, priority);
        return `Terkirim ke ${r.recipients} peserta di ${r.sessions} sesi, tampil dalam ±15 detik`;
      }
      const r = await sessionApi.announce(sessionId!, { body, priority, target: to ? 'selected' : 'all', ...(to ? { user_ids: to.map((p) => p.user_id) } : {}) });
      return `Terkirim ke ${r.recipients} peserta, tampil dalam ±15 detik`;
    },
    {
      success: (msg) => msg,
      toastErrors: false,
      onSuccess: () => {
        if (sessionId) void qc.invalidateQueries({ queryKey: announcementsKey(sessionId) });
        onSent?.();
        onClose();
      },
    },
  );
  const fe = send.fields;
  const target = broadcast ? 'Semua peserta di semua sesi yang sedang berlangsung' : to ? (to.length === 1 ? to[0].full_name : `${to.length} peserta terpilih`) : 'Semua peserta sesi ini';
  const len = [...body.trim()].length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Kirim pengumuman"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button icon={<Megaphone className="h-4 w-4" />} loading={send.isPending} disabled={len === 0 || len > MAX_LEN} onClick={() => send.mutate(undefined)}>
            Kirim
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Untuk: <strong>{target}</strong>
          </span>
        </div>
        <Field label="Isi pengumuman" error={fe.body ?? fe.user_ids ?? fe.session_ids ?? fe.running} hint={`${len}/${MAX_LEN} karakter. Teks biasa; tautan tidak bisa diklik peserta.`}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_LEN} rows={4} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBody(t)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {t}
            </button>
          ))}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Cara tampil</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: 'info', title: 'Biasa', text: 'Banner di atas soal, bisa ditutup peserta.' },
                { v: 'important', title: 'Penting', text: 'Jendela yang harus dikonfirmasi "Saya mengerti". Waktu tetap berjalan.' },
              ] as const
            ).map((o) => (
              <label
                key={o.v}
                className={cx(
                  'flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 text-xs',
                  priority === o.v ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                <input type="radio" name="priority" className="mt-0.5" checked={priority === o.v} onChange={() => setPriority(o.v)} />
                <span>
                  <span className="block font-medium text-slate-900 dark:text-white">{o.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">{o.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {send.error && !Object.keys(fe).length && <p className="text-xs text-rose-600 dark:text-rose-400">{(send.error as Error).message}</p>}
      </div>
    </Modal>
  );
}

/** AnnouncementHistory lists a session's announcements with who read them; senders and managers can retract. */
export function AnnouncementHistory({ sessionId }: { sessionId: string }) {
  const list = useAnnouncements(sessionId);
  const { me } = useAuth();
  const can = useCan();
  const qc = useQueryClient();
  const [readers, setReaders] = useState<string | null>(null);
  const [retracting, setRetracting] = useState<string | null>(null);
  const retract = useAction((aid: string) => sessionApi.retractAnnouncement(sessionId, aid), {
    success: 'Pengumuman ditarik',
    onSuccess: () => {
      setRetracting(null);
      void qc.invalidateQueries({ queryKey: announcementsKey(sessionId) });
    },
  });
  const items = list.data?.announcements ?? [];

  return (
    <Card title="Riwayat pengumuman" className="mt-6">
      {list.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada pengumuman di sesi ini.</p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((a) => {
            const mine = a.sender.user_id === me?.id || can(Perm.SessionManage);
            return (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">{formatTime(a.created_at)}</span> · {a.sender.full_name}
                    {a.priority === 'important' && <Badge tone="red">Penting</Badge>}
                    {a.target === 'selected' && <Badge>Peserta terpilih</Badge>}
                    {a.retracted_at && <Badge tone="amber">Ditarik</Badge>}
                  </p>
                  <p className={cx('mt-1 whitespace-pre-line break-words text-xs leading-5', a.retracted_at ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200')}>{a.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReaders(a.id)}
                    className={cx(
                      'text-xs font-medium tabular-nums hover:underline',
                      a.read < a.recipients && !a.retracted_at ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300',
                    )}
                  >
                    Dibaca {a.read}/{a.recipients}
                  </button>
                  {mine && !a.retracted_at && (
                    <Button size="sm" variant="ghost" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setRetracting(a.id)}>
                      Tarik
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {readers && <ReadersModal sessionId={sessionId} announcementId={readers} onClose={() => setReaders(null)} />}
      {retracting && (
        <ConfirmDialog open title="Tarik pengumuman?" loading={retract.isPending} onClose={() => setRetracting(null)} onConfirm={() => retract.mutate(retracting)}>
          Peserta akan melihat bahwa pengumuman ini ditarik, tanpa isinya. Tercatat di log.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function ReadersModal({ sessionId, announcementId, onClose }: { sessionId: string; announcementId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['announcement-recipients', announcementId], queryFn: () => sessionApi.announcementRecipients(sessionId, announcementId), refetchInterval: 10_000 });
  const rows = q.data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;
  return (
    <Modal open onClose={onClose} title="Penerima pengumuman" size="sm">
      {q.isLoading ? (
        <Loading />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {unread ? `${unread} dari ${rows.length} peserta belum membaca.` : `Semua ${rows.length} peserta sudah membaca.`}
          </p>
          <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {rows.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900 dark:text-white">{r.full_name}</span>
                  <span className="text-[11px] text-slate-500">
                    {r.username}
                    {r.seat && ` · kursi ${r.seat}`}
                  </span>
                </span>
                {r.read_at ? <span className="shrink-0 tabular-nums text-slate-500">Dibaca {formatTime(r.read_at)}</span> : <Badge tone="amber">Belum dibaca</Badge>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
