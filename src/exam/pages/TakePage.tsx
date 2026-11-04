import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  Eye,
  FileText,
  ImageDown,
  Flag,
  Lock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Settings2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import type { AttemptView, ItemView, Response } from '@/shared/api/types';
import { StaticMedia } from '@/shared/item/media';
import { RichContent } from '@/shared/item/RichContent';
import { errorMessage } from '@/shared/lib/errors';
import { formatClock, labels } from '@/shared/lib/format';
import { Brand, BrandTitle, usePublicTenant } from '@/shared/auth/pages';
import { Alert, Badge, Button, cx, IconButton, Loading, Modal, useToast } from '@/shared/ui';
import { activeSection, isAnswered, useAttemptEngine, type AttemptEngine, type FlatItem, type Snapshot } from '../engine';
import type { MediaProgress } from '../mediaCache';

type FontScale = 'normal' | 'large' | 'xl';
const fontClass: Record<FontScale, string> = { normal: 'text-base', large: 'text-lg', xl: 'text-xl' };
const PREFS = 'doexam.exam.prefs';

function loadPrefs(): { font: FontScale; contrast: boolean } {
  try {
    return { font: 'normal', contrast: false, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') };
  } catch {
    return { font: 'normal', contrast: false };
  }
}

export function TakePage() {
  const { id = '' } = useParams();
  const initial = (useLocation().state as { view?: AttemptView } | null)?.view;
  const [engine, s] = useAttemptEngine(id, initial);

  if (s.phase === 'loading' || !engine) return <Loading label="Menyiapkan ujian…" />;
  if (s.phase === 'done') return <Navigate to={`/result/${id}`} replace />;
  if (s.phase === 'error') {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>{s.error ? errorMessage(new Error(s.error)) : 'Ujian tidak bisa dibuka.'}</Alert>
        <a href="/exam/" className="mt-4 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
          Kembali ke daftar ujian
        </a>
      </div>
    );
  }
  return <ExamRoom engine={engine} s={s} />;
}

function ExamRoom({ engine, s }: { engine: AttemptEngine; s: Snapshot }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const { data: tenant } = usePublicTenant();
  const view = s.view!;
  const items = s.items;
  const idx = Math.max(0, items.findIndex((i) => i.id === s.current));
  const item = items[idx];
  const forwardOnly = view.navigation === 'forward_only';
  const standard = view.security_profile === 'standard';
  const section = activeSection(view);
  const sequential = view.section_mode === 'sequential';
  const isLastSection = !view.sections.some((x) => x.state === 'pending');
  const readOnly = !engine.canAnswer;

  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // focus & fullscreen tracking (recorded as events for the proctor)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        engine.recordFocus('FOCUS_LOST');
      } else {
        engine.recordFocus('FOCUS_RETURNED');
        toast('warning', 'Anda meninggalkan halaman ujian', 'Kejadian ini tercatat oleh pengawas.');
      }
    };
    const onFullscreen = () => {
      const on = !!document.fullscreenElement;
      setFullscreen(on);
      if (!on) engine.recordFocus('FULLSCREEN_EXIT');
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [engine, toast]);

  const go = useCallback(
    (delta: number) => {
      const next = items[idx + delta];
      if (next) engine.goTo(next.id);
    },
    [engine, idx, items],
  );

  // keyboard: ←/→ move, 1–9 pick an option, F flags (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || submitOpen) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft' && !forwardOnly) go(-1);
      else if ((e.key === 'f' || e.key === 'F') && item) engine.flag(item.id, !s.flags[item.id]);
      else if (/^[1-9]$/.test(e.key) && item?.options && item.type === 'mcq_single') {
        const opt = item.options[Number(e.key) - 1];
        if (opt) engine.answer(item.id, { selected: opt.id });
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [engine, go, item, forwardOnly, s.flags, submitOpen]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  const answered = items.filter((i) => isAnswered(s.responses[i.id])).length;
  const flagged = items.filter((i) => s.flags[i.id]).length;
  const hc = prefs.contrast;

  return (
    <StaticMedia refs={view.media}>
    <div className={cx('flex min-h-screen flex-col', hc ? 'hc' : 'bg-slate-50 dark:bg-slate-950')}>
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <span className="hidden shrink-0 sm:block">
            <Brand tenant={tenant} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-white">{view.exam_title}</h1>
            <p className="truncate text-xs leading-4 tabular-nums text-slate-500 dark:text-slate-400">
              <span className="sm:hidden">
                Soal {idx + 1}/{items.length}
              </span>
              <span className="hidden sm:inline">
                {tenant?.name ? `${tenant.name} · ` : ''}
                {sequential && section ? `${section.title} · ` : ''}Soal {idx + 1} dari {items.length}
              </span>
            </p>
          </div>
          <SyncBadge engine={engine} s={s} />
          <Timer engine={engine} s={s} />
          <div className="hidden items-center gap-1.5 md:flex">
            <ViewTools prefs={prefs} setPrefs={setPrefs} fullscreen={fullscreen} onFullscreen={toggleFullscreen} />
          </div>
          <IconButton label="Tampilan" className="md:hidden" aria-expanded={toolsOpen} onClick={() => setToolsOpen((o) => !o)}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
        </div>
        {toolsOpen && (
          <div className="flex items-center justify-end gap-1.5 border-t border-slate-200 px-4 py-2 md:hidden dark:border-slate-800">
            <ViewTools prefs={prefs} setPrefs={setPrefs} fullscreen={fullscreen} onFullscreen={toggleFullscreen} />
          </div>
        )}
      </header>

      <MediaStatus progress={s.media} />

      {s.notice && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6">
          <Alert tone={s.notice.tone}>
            <div className="flex items-center justify-between gap-2">
              <span>{s.notice.message}</span>
              <button type="button" className="text-xs font-medium underline" onClick={() => engine.dismissNotice()}>
                Tutup
              </button>
            </div>
          </Alert>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* question */}
        <section
          className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs lg:min-h-[calc(100vh-7rem)] dark:border-slate-800 dark:bg-slate-900"
          onContextMenu={standard ? (e) => e.preventDefault() : undefined}
          onCopy={standard ? (e) => e.preventDefault() : undefined}
        >
          {item ? (
            <div className="flex-1 space-y-6 px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">Soal {item.number}</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {labels.itemType[item.type]} · {item.max_points} poin
                </span>
              </div>

              {item.stimulus && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 sm:text-sm dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-900 dark:text-white">
                    <FileText className="h-3.5 w-3.5 text-slate-400" /> {item.stimulus.title || 'Bacaan'}
                  </div>
                  <RichContent html={item.stimulus.body} />
                </div>
              )}

              <RichContent html={item.stem} className={cx('max-w-[72ch] text-slate-900 select-none dark:text-slate-100', fontClass[prefs.font])} />

              <AnswerInput
                key={item.id}
                item={item}
                value={s.responses[item.id] ?? null}
                disabled={readOnly}
                font={fontClass[prefs.font]}
                onChange={(r) => engine.answer(item.id, r)}
              />
            </div>
          ) : (
            <div className="flex-1 p-6">
              <Alert tone="blue">Tidak ada soal di bagian ini.</Alert>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4 sm:px-8 dark:border-slate-800">
            <Button variant="secondary" size="lg" disabled={idx === 0 || forwardOnly} onClick={() => go(-1)} icon={<ChevronLeft className="h-4 w-4" />}>
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            {item && (
              <button
                type="button"
                aria-pressed={!!s.flags[item.id]}
                disabled={readOnly}
                onClick={() => engine.flag(item.id, !s.flags[item.id])}
                className={cx(
                  'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium shadow-xs transition-colors disabled:opacity-55',
                  s.flags[item.id]
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
                )}
              >
                <Flag className={cx('h-4 w-4', s.flags[item.id] ? 'fill-amber-400 text-amber-600' : 'text-slate-400')} />
                Ragu-ragu
                <kbd className="hidden rounded border border-current/20 px-1 font-sans text-[11px] opacity-60 sm:inline">F</kbd>
              </button>
            )}
            <span className="flex-1" />
            {idx < items.length - 1 ? (
              <Button size="lg" onClick={() => go(1)}>
                Berikutnya <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" disabled={readOnly} onClick={() => setSubmitOpen(true)} icon={<Send className="h-4 w-4" />}>
                {sequential && !isLastSection ? 'Selesai bagian ini' : 'Kumpulkan'}
              </Button>
            )}
          </div>
        </section>

        {/* navigator */}
        <aside className="space-y-4 lg:sticky lg:top-22">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Navigasi soal</h2>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {answered}/{items.length}
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
                {items.map((it, i) => (
                  <NavCell
                    key={it.id}
                    item={it}
                    current={it.id === s.current}
                    answered={isAnswered(s.responses[it.id])}
                    flagged={!!s.flags[it.id]}
                    disabled={forwardOnly && i < s.furthest}
                    onClick={() => engine.goTo(it.id)}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Legend className="bg-blue-600" label="Dijawab" />
                <Legend className="bg-amber-300 ring-1 ring-inset ring-amber-500" label="Ragu-ragu" />
                <Legend className="bg-white ring-1 ring-inset ring-slate-300 dark:bg-slate-900 dark:ring-slate-600" label="Kosong" />
              </div>
            </div>
            <dl className="grid grid-cols-3 border-t border-slate-200 text-center dark:border-slate-800">
              {[
                ['Dijawab', answered],
                ['Ragu', flagged],
                ['Kosong', items.length - answered],
              ].map(([label, n], i) => (
                <div key={label} className={cx('px-2 py-3', i > 0 && 'border-l border-slate-200 dark:border-slate-800')}>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{n}</dd>
                  <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
          {view.sections.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2.5 text-sm font-semibold text-slate-900 dark:text-white">Bagian ujian</h2>
              <ul className="space-y-1.5">
                {[...view.sections]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((sec) => (
                    <li key={sec.id} className="flex items-center justify-between gap-2">
                      <span className={sec.state === 'active' ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}>{sec.title}</span>
                      <Badge tone={sec.state === 'active' ? 'blue' : sec.state === 'closed' ? 'green' : 'slate'}>
                        {sec.state === 'closed' ? 'Selesai' : sec.state === 'pending' ? 'Belum' : `${sec.item_count} soal`}
                      </Badge>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <Button size="lg" className="w-full" disabled={readOnly} onClick={() => setSubmitOpen(true)} icon={<Send className="h-4 w-4" />}>
            {sequential && !isLastSection ? 'Selesai bagian ini' : 'Kumpulkan ujian'}
          </Button>
          {/* phones hide the logo in the header to keep the title readable; the institution shows here instead */}
          <div className="flex justify-center pt-2 sm:hidden">
            <BrandTitle tenant={tenant} />
          </div>
        </aside>
      </div>

      {submitOpen && (
        <SubmitDialog
          engine={engine}
          s={s}
          sectionOnly={sequential && !isLastSection}
          answered={answered}
          flagged={flagged}
          onClose={() => setSubmitOpen(false)}
          onDone={(closed) => {
            setSubmitOpen(false);
            if (closed) navigate(`/result/${engine.attemptId}`, { replace: true });
          }}
        />
      )}

      {s.status === 'locked' && (
        <Overlay icon={<Lock className="h-5 w-5 text-amber-600" />} title="Ujian dikunci pengawas">
          Tunggu sampai pengawas membuka kembali. Jawaban Anda aman.
          <Button variant="secondary" className="mt-5" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void engine.sync()}>
            Periksa lagi
          </Button>
        </Overlay>
      )}
      {s.expired && (
        <Overlay icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} title="Waktu habis">
          {s.pending > 0 ? 'Mengirim jawaban terakhir… jangan tutup halaman ini.' : 'Jawaban Anda sudah tersimpan.'}
        </Overlay>
      )}
      {standard && !fullscreen && s.status === 'in_progress' && !s.expired && (
        <Overlay icon={<Maximize2 className="h-5 w-5 text-blue-600" />} title="Ujian dikerjakan dalam layar penuh">
          Keluar dari layar penuh tercatat oleh pengawas.
          <Button className="mt-5" size="lg" onClick={toggleFullscreen}>
            Masuk layar penuh
          </Button>
        </Overlay>
      )}
    </div>
    </StaticMedia>
  );
}

type Prefs = { font: FontScale; contrast: boolean };

function ViewTools({ prefs, setPrefs, fullscreen, onFullscreen }: { prefs: Prefs; setPrefs: (f: (p: Prefs) => Prefs) => void; fullscreen: boolean; onFullscreen: () => void }) {
  const hc = prefs.contrast;
  return (
    <>
      <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="Ukuran huruf">
        {(['normal', 'large', 'xl'] as FontScale[]).map((f, i) => (
          <button
            key={f}
            type="button"
            aria-pressed={prefs.font === f}
            onClick={() => setPrefs((p) => ({ ...p, font: f }))}
            className={cx(
              'h-full rounded-md px-2 text-xs font-medium',
              prefs.font === f ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
            )}
            title={['Ukuran huruf normal', 'Huruf besar', 'Huruf sangat besar'][i]}
          >
            {['A', 'A+', 'A++'][i]}
          </button>
        ))}
      </div>
      <IconButton label="Kontras tinggi" aria-pressed={hc} onClick={() => setPrefs((p) => ({ ...p, contrast: !p.contrast }))}>
        <Eye className="h-4 w-4" />
      </IconButton>
      <IconButton label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'} onClick={onFullscreen}>
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </IconButton>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-3 w-3 rounded-sm', className)} /> {label}
    </span>
  );
}

// Status reads without colour too: filled = answered, outline = empty, corner mark = flagged.
function NavCell({ item, current, answered, flagged, disabled, onClick }: { item: FlatItem; current: boolean; answered: boolean; flagged: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? 'step' : undefined}
      aria-label={`Soal ${item.number}${answered ? ', dijawab' : ', kosong'}${flagged ? ', ragu-ragu' : ''}`}
      className={cx(
        'relative h-9 rounded-lg text-xs font-medium tabular-nums transition-colors disabled:opacity-40',
        flagged
          ? 'bg-amber-300 text-amber-950 ring-1 ring-inset ring-amber-500'
          : answered
            ? 'bg-blue-600 text-accent-fg hover:bg-blue-700'
            : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:ring-slate-400 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600',
        current && 'outline-2 outline-offset-2 outline-slate-900 dark:outline-white',
      )}
    >
      {item.number}
      {flagged && <span className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-amber-700" />}
      {flagged && answered && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-900" />}
    </button>
  );
}

function Timer({ engine, s }: { engine: AttemptEngine; s: Snapshot }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = s.deadlineMs ? engine.remainingSeconds() : 0;
  const critical = left < 300;
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label="Sisa waktu"
      className={cx(
        'flex h-10 items-center gap-2 rounded-lg px-2.5 tabular-nums sm:px-3',
        critical ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white',
      )}
    >
      <Clock className={cx('hidden h-4 w-4 sm:block', critical ? 'text-rose-500' : 'text-slate-400')} />
      <span className="text-lg font-semibold tracking-tight">{formatClock(left)}</span>
    </div>
  );
}

/**
 * MediaStatus reports the download of the pictures while it runs, and stays only when some
 * could not be downloaded (they still load whenever the network is there).
 */
function MediaStatus({ progress: p }: { progress?: MediaProgress }) {
  if (!p || !p.total) return null;
  const busy = p.ready + p.failed < p.total;
  if (!busy && !p.failed) return null;
  return (
    <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6" aria-live="polite">
      {busy ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <ImageDown className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="tabular-nums">
            Menyiapkan gambar soal {p.ready + p.failed} dari {p.total}
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <span className="block h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${((p.ready + p.failed) / p.total) * 100}%` }} />
          </span>
        </div>
      ) : (
        <Alert tone="amber">
          {p.failed} gambar soal belum terunduh. Gambar itu tetap tampil selama koneksi ada; jawaban Anda tidak terpengaruh.
        </Alert>
      )}
    </div>
  );
}

const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

/** SyncBadge always pairs the claim with its evidence: last server sync and the local queue. */
function SyncBadge({ engine, s }: { engine: AttemptEngine; s: Snapshot }) {
  const offline = !s.online;
  const pending = s.pending > 0;
  const at = s.lastSyncAt ? clock.format(s.lastSyncAt) : null;
  const label = offline ? 'Offline' : pending ? 'Menyimpan' : 'Tersimpan';
  const detail = offline || pending || !at ? `${s.pending} antre` : at;
  return (
    <button
      type="button"
      onClick={() => void engine.sync()}
      title={offline ? 'Tidak terhubung. Jawaban aman di perangkat dan dikirim saat koneksi kembali.' : pending ? 'Mengirim jawaban ke server…' : 'Semua jawaban tersimpan di server. Klik untuk sinkron ulang.'}
      className={cx(
        'flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 ring-inset',
        offline
          ? 'bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800'
          : pending
            ? 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
            : 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
      )}
    >
      {offline ? (
        <CloudOff className="h-3.5 w-3.5" />
      ) : pending ? (
        <RefreshCw className={cx('h-3.5 w-3.5', s.syncing && 'animate-spin')} />
      ) : (
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      )}
      <span className="sr-only sm:not-sr-only">{label}</span>
      {detail && <span className="tabular-nums sm:opacity-70">{detail}</span>}
    </button>
  );
}

function Overlay({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
      <div role="alertdialog" aria-label={title} className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">{icon}</span>
        <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        <div className="mt-1.5 flex flex-col items-center text-xs text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </div>
  );
}

// ── answers ────────────────────────────────────────────────────
const letter = (i: number) => String.fromCharCode(65 + i);

function AnswerInput({ item, value, disabled, font, onChange }: { item: ItemView; value: Response | null; disabled: boolean; font: string; onChange: (r: Response | null) => void }) {
  const optionClass = (on: boolean) =>
    cx(
      'flex w-full max-w-[72ch] items-start gap-3.5 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed',
      on
        ? 'border-blue-600 bg-blue-50 text-slate-900 ring-1 ring-inset ring-blue-600 dark:border-blue-400 dark:bg-blue-950/50 dark:text-white dark:ring-blue-400'
        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800/60',
    );

  switch (item.type) {
    case 'mcq_single': {
      const sel = value && 'selected' in value ? value.selected : undefined;
      return (
        <div className="space-y-2.5" role="radiogroup">
          {item.options?.map((o, i) => {
            const on = sel === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} className={optionClass(on)} onClick={() => onChange(on ? null : { selected: o.id })}>
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    on ? 'bg-blue-600 text-accent-fg' : 'text-slate-600 ring-1 ring-inset ring-slate-300 dark:text-slate-300 dark:ring-slate-600',
                  )}
                >
                  {letter(i)}
                </span>
                <RichContent html={o.body} className={cx('flex-1 pt-0.5', font)} />
              </button>
            );
          })}
        </div>
      );
    }
    case 'mcq_multi': {
      const sel = value && 'selected' in value && Array.isArray(value.selected) ? value.selected : [];
      return (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pilih satu atau lebih jawaban yang benar.</p>
          {item.options?.map((o, i) => {
            const on = sel.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={disabled}
                className={optionClass(on)}
                onClick={() => {
                  const next = on ? sel.filter((x) => x !== o.id) : [...sel, o.id];
                  onChange(next.length ? { selected: next } : null);
                }}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                    on ? 'bg-blue-600 text-accent-fg' : 'text-slate-600 ring-1 ring-inset ring-slate-300 dark:text-slate-300 dark:ring-slate-600',
                  )}
                >
                  {on ? <Check className="h-4 w-4" /> : letter(i)}
                </span>
                <RichContent html={o.body} className={cx('flex-1 pt-0.5', font)} />
              </button>
            );
          })}
        </div>
      );
    }
    case 'true_false': {
      const v = value && 'value' in value ? value.value : undefined;
      return (
        <div className="grid max-w-md grid-cols-2 gap-3" role="radiogroup">
          {[
            { val: true, label: 'Benar', on: 'border-blue-600 bg-blue-50 text-slate-900 ring-1 ring-inset ring-blue-600 dark:bg-blue-950/50 dark:text-white' },
            { val: false, label: 'Salah', on: 'border-blue-600 bg-blue-50 text-slate-900 ring-1 ring-inset ring-blue-600 dark:bg-blue-950/50 dark:text-white' },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              role="radio"
              aria-checked={v === b.val}
              disabled={disabled}
              onClick={() => onChange(v === b.val ? null : { value: b.val })}
              className={cx(
                'rounded-xl border py-3.5 text-sm font-medium transition-colors',
                v === b.val ? b.on : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/60',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      );
    }
    case 'short_answer':
      return <TextAnswer value={value} disabled={disabled} onChange={onChange} numeric={item.input === 'number'} font={font} />;
    case 'essay':
      return <TextAnswer value={value} disabled={disabled} onChange={onChange} multiline maxWords={item.max_words} font={font} />;
  }
}

/** TextAnswer keeps typing local and saves after a pause (one event per pause, not per key). */
function TextAnswer({
  value,
  disabled,
  onChange,
  multiline,
  numeric,
  maxWords,
  font,
}: {
  value: Response | null;
  disabled: boolean;
  onChange: (r: Response | null) => void;
  multiline?: boolean;
  numeric?: boolean;
  maxWords?: number;
  font: string;
}) {
  const initial = value && 'text' in value ? value.text : '';
  const [text, setText] = useState(initial);
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commit = useCallback(
    (t: string) => {
      clearTimeout(timer.current);
      if (t === last.current) return;
      last.current = t;
      onChange(t.trim() ? { text: t } : null);
    },
    [onChange],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = (t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(t), 800);
  };
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const cls = cx(
    'w-full max-w-[72ch] rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
    font,
  );
  return (
    <div className="space-y-1.5">
      {multiline ? (
        <textarea className={cx(cls, 'min-h-56')} value={text} disabled={disabled} onChange={(e) => update(e.target.value)} onBlur={() => commit(text)} placeholder="Tulis jawaban Anda…" />
      ) : (
        <input
          className={cls}
          value={text}
          disabled={disabled}
          inputMode={numeric ? 'decimal' : 'text'}
          onChange={(e) => update(e.target.value)}
          onBlur={() => commit(text)}
          placeholder={numeric ? 'Jawaban berupa angka, mis. 12,5' : 'Jawaban singkat'}
          maxLength={500}
        />
      )}
      {multiline && (
        <p className={cx('max-w-[72ch] text-right text-[11px] tabular-nums', maxWords && words > maxWords ? 'font-medium text-rose-600' : 'text-slate-500')}>
          {words} kata{maxWords ? ` / maks. ${maxWords}` : ''}
        </p>
      )}
    </div>
  );
}

function SubmitDialog({
  engine,
  s,
  sectionOnly,
  answered,
  flagged,
  onClose,
  onDone,
}: {
  engine: AttemptEngine;
  s: Snapshot;
  sectionOnly: boolean;
  answered: number;
  flagged: number;
  onClose: () => void;
  onDone: (closed: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = s.items.length - answered;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const section = activeSection(s.view);
      if (sectionOnly && section) {
        await engine.finishSection(section.id);
        onDone(false);
      } else {
        await engine.submit();
        onDone(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={sectionOnly ? 'Selesaikan bagian ini?' : 'Kumpulkan ujian?'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Periksa lagi
          </Button>
          <Button loading={busy} onClick={() => void confirm()}>
            {sectionOnly ? 'Ya, lanjut ke bagian berikutnya' : 'Ya, kumpulkan'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <dl className="grid grid-cols-3 rounded-xl border border-slate-200 text-center dark:border-slate-700">
          {[
            ['Dijawab', answered, 'text-slate-900 dark:text-white'],
            ['Ragu-ragu', flagged, flagged ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'],
            ['Kosong', empty, empty ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'],
          ].map(([label, n, tone], i) => (
            <div key={label as string} className={cx('px-2 py-3', i > 0 && 'border-l border-slate-200 dark:border-slate-700')}>
              <dd className={cx('text-xl font-semibold tabular-nums', tone as string)}>{n}</dd>
              <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
            </div>
          ))}
        </dl>
        {sectionOnly ? (
          <p className="text-slate-600 dark:text-slate-300">Setelah lanjut, bagian ini tidak bisa dibuka lagi.</p>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">Setelah dikumpulkan, jawaban tidak bisa diubah.</p>
        )}
        {(empty > 0 || flagged > 0) && (
          <Alert tone="amber">
            Masih ada soal kosong atau ragu-ragu.
          </Alert>
        )}
        {!s.online && <Alert tone="amber">Tidak terhubung ke server. Jawaban dikirim setelah koneksi kembali; coba lagi sebentar.</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

