import { Megaphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MyAnnouncement } from '@/shared/api/types';
import { formatTime } from '@/shared/lib/format';
import { Button, cx } from '@/shared/ui';

// Announcements from proctors and the committee (DOCS/PLAN/12-PENGUMUMAN-PESERTA.md).
// Text is plain: rendered as React text, never as HTML, and links are not clickable.

const fromLabel = (a: MyAnnouncement) => (a.from === 'proctor' ? 'Pengawas' : 'Panitia');
const pending = (a: MyAnnouncement) => !a.read_at && !a.retracted_at;

/**
 * AnnouncementLayer shows what still needs the participant's attention: the oldest
 * unconfirmed important announcement as a dialog (the timer keeps running behind it),
 * otherwise the newest unread info announcement as a banner.
 */
export function AnnouncementLayer({ items, onConfirm, className }: { items: MyAnnouncement[]; onConfirm: (id: string) => void; className?: string }) {
  const important = items.filter((a) => pending(a) && a.priority === 'important').at(-1); // list is newest first
  const info = items.find((a) => pending(a) && a.priority === 'info');

  return (
    <>
      {info && !important && (
        <div className={cx('mx-auto w-full max-w-7xl px-4 sm:px-6', className)}>
          <div role="status" className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-blue-800/80 dark:text-blue-200/80">
                Pengumuman {fromLabel(info)} · {formatTime(info.created_at)}
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-6">{info.body}</p>
            </div>
            <button
              type="button"
              onClick={() => onConfirm(info.id)}
              className="-mr-1 shrink-0 rounded-md p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/60"
              aria-label="Tutup pengumuman"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {important && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 dark:bg-black/70">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="announcement-title"
            aria-describedby="announcement-body"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <h2 id="announcement-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  Pengumuman penting
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dari {fromLabel(important).toLowerCase()} · {formatTime(important.created_at)}
                </p>
              </div>
            </div>
            <p id="announcement-body" className="mt-4 whitespace-pre-line break-words text-base leading-7 text-slate-900 dark:text-slate-100">
              {important.body}
            </p>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Waktu ujian tetap berjalan.</p>
            <Button key={important.id} autoFocus size="lg" className="mt-5 w-full" onClick={() => onConfirm(important.id)}>
              Saya mengerti
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** AnnouncementInbox is the header button with the unread count and the full list. */
export function AnnouncementInbox({ items, onConfirm }: { items: MyAnnouncement[]; onConfirm: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter(pending).length;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!items.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Pengumuman, ${unread} belum dibaca` : 'Pengumuman'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Megaphone className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold tabular-nums text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[22rem] border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:text-white">Pengumuman</p>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {items.map((a) => (
              <li key={a.id} className={cx('px-4 py-3', pending(a) && 'bg-blue-50/60 dark:bg-blue-950/30')}>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {a.priority === 'important' && <span className="font-semibold text-rose-600 dark:text-rose-400">Penting ·</span>}
                  {fromLabel(a)} · <span className="tabular-nums">{formatTime(a.created_at)}</span>
                </p>
                {a.retracted_at ? (
                  <p className="mt-1 text-sm italic text-slate-400">Pengumuman ini ditarik.</p>
                ) : (
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-800 dark:text-slate-200">{a.body}</p>
                )}
                {pending(a) && (
                  <button type="button" className="mt-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={() => onConfirm(a.id)}>
                    Tandai sudah dibaca
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
