import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Eye,
  FileText,
  Lock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import type { AttemptView, ItemView, Response } from '@/shared/api/types';
import { RichContent } from '@/shared/item/RichContent';
import { errorMessage } from '@/shared/lib/errors';
import { formatClock, labels } from '@/shared/lib/format';
import { Alert, Button, cx, Loading, Modal, useToast } from '@/shared/ui';
import { activeSection, isAnswered, useAttemptEngine, type AttemptEngine, type FlatItem, type Snapshot } from '../engine';

type FontScale = 'normal' | 'large' | 'xl';
const fontClass: Record<FontScale, string> = { normal: 'text-sm', large: 'text-base', xl: 'text-lg' };
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
        <a href="/exam/" className="mt-4 inline-block text-xs font-semibold text-blue-600 hover:underline">
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
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
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
    <div className={cx('flex min-h-screen flex-col', hc ? 'hc' : 'bg-slate-50 dark:bg-slate-950')}>
      {/* toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h1 className="max-w-[280px] truncate text-xs font-bold tracking-tight sm:max-w-md sm:text-sm">{view.exam_title}</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {sequential && section ? `${section.title} · ` : ''}Soal {idx + 1} dari {items.length}
          </p>
        </div>
        <Timer engine={engine} s={s} />
        <div className="flex items-center gap-2">
          <SyncBadge engine={engine} s={s} />
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
            {(['normal', 'large', 'xl'] as FontScale[]).map((f, i) => (
              <button
                key={f}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, font: f }))}
                className={cx('rounded px-2 py-1', prefs.font === f ? 'bg-white shadow-xs dark:bg-slate-700' : 'text-slate-500')}
                title={['Ukuran huruf normal', 'Huruf besar', 'Huruf sangat besar'][i]}
              >
                {['A', 'A+', 'A++'][i]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, contrast: !p.contrast }))}
            title="Kontras tinggi"
            className={cx('rounded-lg border p-1.5', hc ? 'border-yellow-400' : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300')}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {s.notice && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <Alert tone={s.notice.tone}>
            <div className="flex items-center justify-between gap-2">
              <span>{s.notice.message}</span>
              <button type="button" className="text-[11px] font-semibold underline" onClick={() => engine.dismissNotice()}>
                Tutup
              </button>
            </div>
          </Alert>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-12">
        {/* question */}
        <div
          className="flex flex-col justify-between gap-6 lg:col-span-8"
          onContextMenu={standard ? (e) => e.preventDefault() : undefined}
          onCopy={standard ? (e) => e.preventDefault() : undefined}
        >
          {item ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">Nomor {item.number}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">{labels.itemType[item.type]}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{item.max_points} poin</span>
                </div>
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={!!s.flags[item.id]}
                    disabled={readOnly}
                    onChange={(e) => engine.flag(item.id, e.target.checked)}
                    className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className={s.flags[item.id] ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>Ragu-ragu</span>
                </label>
              </div>

              {item.stimulus && (
                <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-4 text-xs text-slate-700 sm:text-sm dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-slate-300">
                  <div className="mb-2 flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                    <FileText className="h-3.5 w-3.5" /> {item.stimulus.title || 'Bacaan'}
                  </div>
                  <RichContent html={item.stimulus.body} />
                </div>
              )}

              <RichContent html={item.stem} className={cx('font-medium text-slate-900 select-none dark:text-slate-100', fontClass[prefs.font])} />

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
            <Alert tone="blue">Tidak ada soal di bagian ini.</Alert>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button variant="secondary" size="lg" disabled={idx === 0 || forwardOnly} onClick={() => go(-1)} icon={<ChevronLeft className="h-4 w-4" />}>
              Sebelumnya
            </Button>
            {idx < items.length - 1 ? (
              <Button size="lg" onClick={() => go(1)}>
                Berikutnya <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" variant="success" onClick={() => setSubmitOpen(true)} icon={<Send className="h-4 w-4" />}>
                {sequential && !isLastSection ? 'Selesai bagian ini' : 'Kumpulkan'}
              </Button>
            )}
          </div>
        </div>

        {/* navigator */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold">Navigasi soal</h2>
              <span className="text-[11px] text-slate-500">
                {answered}/{items.length} terjawab
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
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
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
              <Legend className="bg-blue-600" label="Terjawab" />
              <Legend className="bg-amber-400" label="Ragu-ragu" />
              <Legend className="border border-slate-300 bg-white dark:bg-slate-800" label="Kosong" />
            </div>
          </div>
          {view.sections.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 font-bold">Bagian ujian</h2>
              <ul className="space-y-1.5">
                {[...view.sections]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((sec) => (
                    <li key={sec.id} className="flex items-center justify-between gap-2">
                      <span className={sec.state === 'active' ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-slate-500'}>{sec.title}</span>
                      <span className="text-[11px] text-slate-400">
                        {sec.state === 'closed' ? 'selesai' : sec.state === 'pending' ? 'belum' : `${sec.item_count} soal`}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <Button variant="success" size="lg" className="w-full" disabled={readOnly} onClick={() => setSubmitOpen(true)} icon={<Send className="h-4 w-4" />}>
            {sequential && !isLastSection ? 'Selesai bagian ini' : 'Kumpulkan ujian'}
          </Button>
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
        <Overlay icon={<Lock className="h-10 w-10 text-amber-500" />} title="Ujian dikunci pengawas">
          Tunggu sampai pengawas membuka kembali. Jawaban Anda aman.
          <Button variant="secondary" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void engine.sync()}>
            Periksa lagi
          </Button>
        </Overlay>
      )}
      {s.expired && (
        <Overlay icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />} title="Waktu habis">
          {s.pending > 0 ? 'Mengirim jawaban terakhir… jangan tutup halaman ini.' : 'Jawaban Anda sudah tersimpan.'}
        </Overlay>
      )}
      {standard && !fullscreen && s.status === 'in_progress' && !s.expired && (
        <Overlay icon={<Maximize2 className="h-10 w-10 text-blue-500" />} title="Ujian dikerjakan dalam layar penuh">
          Keluar dari layar penuh tercatat oleh pengawas.
          <Button className="mt-4" size="lg" onClick={toggleFullscreen}>
            Masuk layar penuh
          </Button>
        </Overlay>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-3 w-3 rounded', className)} /> {label}
    </span>
  );
}

function NavCell({ item, current, answered, flagged, disabled, onClick }: { item: FlatItem; current: boolean; answered: boolean; flagged: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? 'step' : undefined}
      className={cx(
        'relative h-9 rounded-lg text-xs font-bold transition-colors disabled:opacity-40',
        flagged ? 'bg-amber-400 text-amber-950' : answered ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
        current && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900',
      )}
    >
      {item.number}
      {flagged && answered && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-blue-700" />}
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
      className={cx(
        'flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold',
        critical ? 'animate-pulse border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400' : 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      <span className="hidden font-sans text-[11px] font-medium text-slate-500 sm:inline">Sisa waktu</span>
      {formatClock(left)}
    </div>
  );
}

function SyncBadge({ engine, s }: { engine: AttemptEngine; s: Snapshot }) {
  const offline = !s.online;
  const pending = s.pending > 0;
  return (
    <button
      type="button"
      onClick={() => void engine.sync()}
      title={offline ? 'Tidak terhubung — jawaban disimpan di perangkat' : pending ? 'Mengirim jawaban…' : 'Semua jawaban tersimpan di server'}
      className={cx(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
        offline || pending
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      )}
    >
      {offline ? <CloudOff className="h-3.5 w-3.5" /> : pending ? <RefreshCw className={cx('h-3.5 w-3.5', s.syncing && 'animate-spin')} /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{offline ? `Offline · ${s.pending} antre` : pending ? `${s.pending} antre` : 'Tersimpan'}</span>
    </button>
  );
}

function Overlay({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-w-sm flex-col items-center rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900">
        {icon}
        <h2 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
        <div className="mt-1 flex flex-col items-center text-xs text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </div>
  );
}

// ── answers ────────────────────────────────────────────────────
const letter = (i: number) => String.fromCharCode(65 + i);

function AnswerInput({ item, value, disabled, font, onChange }: { item: ItemView; value: Response | null; disabled: boolean; font: string; onChange: (r: Response | null) => void }) {
  const optionClass = (on: boolean) =>
    cx(
      'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed',
      on
        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700',
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
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold', on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
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
          <p className="text-xs italic text-slate-500">Pilih satu atau lebih jawaban yang benar.</p>
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
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold', on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800')}>
                  {on ? '✓' : letter(i)}
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
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: true, label: 'Benar', on: 'border-emerald-600 bg-emerald-600 text-white' },
            { val: false, label: 'Salah', on: 'border-rose-600 bg-rose-600 text-white' },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v === b.val ? null : { value: b.val })}
              className={cx(
                'rounded-xl border py-4 text-sm font-bold transition-colors',
                v === b.val ? b.on : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
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
    'w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
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
        <p className={cx('text-right text-[11px]', maxWords && words > maxWords ? 'font-semibold text-rose-600' : 'text-slate-500')}>
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
          <Button variant="success" loading={busy} onClick={() => void confirm()}>
            {sectionOnly ? 'Ya, lanjut ke bagian berikutnya' : 'Ya, kumpulkan'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
            <p className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{answered}</p>
            <p className="text-slate-500">Terjawab</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
            <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{flagged}</p>
            <p className="text-slate-500">Ragu-ragu</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xl font-extrabold text-slate-700 dark:text-slate-200">{empty}</p>
            <p className="text-slate-500">Kosong</p>
          </div>
        </div>
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

