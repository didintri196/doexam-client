/**
 * Camera & whole-screen sharing UI of the exam client (DOCS/PLAN/19-LIHAT-LAYAR-KAMERA.md §4):
 * the preparation step before starting, and the guard inside the exam (covering the questions
 * while a required share is off, the camera preview, events for the proctor, live views).
 */
import { Camera, CameraOff, Eye, Monitor, MonitorOff, MonitorSmartphone, ScreenShare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, cx } from '@/shared/ui';
import type { AttemptEngine, Snapshot } from './engine';
import { LiveSender } from './liveview';
import { media, MediaProblem, sharingReady, useMedia, type MediaStatus } from './media';

export interface SharingRequirement {
  camera: boolean;
  screen: boolean;
}

export const needsSharing = (r: SharingRequirement) => r.camera || r.screen;

/** sharingOk: what the start button waits for (consent + every required share + one display). */
export function sharingOk(st: MediaStatus, req: SharingRequirement, consent: boolean) {
  return !needsSharing(req) || (consent && sharingReady(st, req));
}

function CameraPreview({ className }: { className?: string }) {
  const st = useMedia();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = st.camera === 'live' ? media.camera : null;
  }, [st.camera]);
  if (st.camera !== 'live') return null;
  return <video ref={ref} autoPlay muted playsInline className={cx('-scale-x-100 rounded-lg bg-slate-900 object-cover', className)} aria-label="Pratinjau kamera Anda" />;
}

function useMediaAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'camera' | 'screen' | null>(null);
  const run = (kind: 'camera' | 'screen') => async () => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'camera' ? media.startCamera() : media.startScreen());
    } catch (e) {
      setError(e instanceof MediaProblem ? e.message : 'Gagal. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };
  return { error, busy, camera: run('camera'), screen: run('screen') };
}

function DisplayWarning({ st }: { st: MediaStatus }) {
  if (st.displays === 'extended') {
    return (
      <Alert tone="amber">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Terdeteksi lebih dari satu monitor. Cabut atau matikan monitor tambahan (mode cermin/duplikat boleh).</span>
          <Button size="sm" variant="secondary" onClick={() => media.checkDisplays()}>
            Periksa lagi
          </Button>
        </div>
      </Alert>
    );
  }
  if (st.displays === 'unknown') {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Browser ini tidak bisa memeriksa jumlah monitor. Pastikan hanya satu monitor yang menyala.</p>;
  }
  return null;
}

/** SharingPrep is the step of the start dialog that turns the required shares on. */
export function SharingPrep({ req, consent, onConsent }: { req: SharingRequirement; consent: boolean; onConsent: (v: boolean) => void }) {
  const st = useMedia();
  const act = useMediaAction();
  const support = media.support();
  useEffect(() => (req.screen ? media.watchDisplays() : undefined), [req.screen]);

  const what = req.camera && req.screen ? 'kamera dan layar' : req.camera ? 'kamera' : 'layar';
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-900 dark:text-white">Ujian ini diawasi lewat {what}</p>
      {!support.secure && <Alert>Kamera dan berbagi layar hanya bisa lewat alamat HTTPS. Minta panitia membuka ujian lewat https://…</Alert>}
      <Checkbox
        checked={consent}
        onChange={(e) => onConsent(e.target.checked)}
        label={
          <span className="leading-relaxed">
            Saya setuju pengawas dapat melihat {what} saya selama ujian. Tayangan tidak direkam.
            {req.screen && ' Seluruh layar ikut terlihat, termasuk notifikasi dan aplikasi lain.'}
          </span>
        }
      />
      <div className="space-y-2">
        {req.camera && (
          <div className="flex items-center gap-3">
            <CameraPreview className="h-12 w-16" />
            {st.camera !== 'live' && (
              <span className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                <CameraOff className="h-5 w-5" />
              </span>
            )}
            <span className="flex-1 text-xs text-slate-700 dark:text-slate-300">Kamera</span>
            {st.camera === 'live' ? (
              <Badge tone="green">Menyala</Badge>
            ) : (
              <Button size="sm" disabled={!consent} loading={act.busy === 'camera'} icon={<Camera className="h-3.5 w-3.5" />} onClick={() => void act.camera()}>
                Nyalakan kamera
              </Button>
            )}
          </div>
        )}
        {req.screen && (
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
              {st.screen === 'live' ? <Monitor className="h-5 w-5 text-green-600" /> : <MonitorOff className="h-5 w-5" />}
            </span>
            <span className="flex-1 text-xs text-slate-700 dark:text-slate-300">
              Seluruh layar
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Pilih &quot;Seluruh layar&quot;, bukan tab atau jendela.</span>
            </span>
            {st.screen === 'live' ? (
              <Badge tone="green">Dibagikan</Badge>
            ) : (
              <Button size="sm" disabled={!consent} loading={act.busy === 'screen'} icon={<ScreenShare className="h-3.5 w-3.5" />} onClick={() => void act.screen()}>
                Bagikan layar
              </Button>
            )}
          </div>
        )}
      </div>
      {req.screen && <DisplayWarning st={st} />}
      {act.error && <Alert>{act.error}</Alert>}
    </div>
  );
}

// What was last reported per attempt, so remounts and React's double effects send nothing twice.
// A page reload starts empty: shares are lost on reload, and that is reported as stopped.
const reported = new Map<string, { camera?: string; screen?: string; extra?: boolean }>();

/**
 * SharingGuard runs inside the exam: it reports share changes, covers the questions while a
 * required share is off or an extra display is attached, shows the camera preview, and serves
 * proctors' live views. Timer, answers and sync keep running underneath.
 */
export function SharingGuard({ engine, s, req }: { engine: AttemptEngine; s: Snapshot; req: SharingRequirement }) {
  const st = useMedia();
  const act = useMediaAction();
  const [viewers, setViewers] = useState(0);
  const [small, setSmall] = useState(false);
  const id = s.view!.id;
  const running = s.status === 'in_progress' || s.status === 'locked';

  useEffect(() => (req.screen && running ? media.watchDisplays() : undefined), [req.screen, running]);

  useEffect(() => {
    if (s.status !== 'in_progress') return;
    const r = reported.get(id) ?? {};
    if (req.camera) {
      if (r.camera !== st.camera && (r.camera !== undefined || st.camera === 'off')) {
        engine.recordMedia(st.camera === 'off' ? 'CAMERA_STOPPED' : 'CAMERA_RESUMED');
      }
      r.camera = st.camera;
    }
    if (req.screen) {
      if (r.screen !== st.screen && (r.screen !== undefined || st.screen === 'off')) {
        engine.recordMedia(st.screen === 'off' ? 'SCREEN_SHARE_STOPPED' : 'SCREEN_SHARE_RESUMED');
      }
      r.screen = st.screen;
      const extra = st.displays === 'extended';
      if (r.extra !== extra && (r.extra !== undefined || extra)) engine.recordMedia(extra ? 'EXTRA_DISPLAY_DETECTED' : 'EXTRA_DISPLAY_REMOVED');
      r.extra = extra;
    }
    reported.set(id, r);
  }, [st, s.status, id, req.camera, req.screen, engine]);

  useEffect(() => {
    if (!running) return;
    const sender = new LiveSender(id, { camera: req.camera, screen: req.screen }, setViewers).start();
    return () => sender.stop();
  }, [id, running, req.camera, req.screen]);

  // the exam is over: stop sharing (camera light off, browser bar gone)
  useEffect(() => {
    if (s.status && !running) media.stop();
  }, [s.status, running]);

  const blocked = running && !sharingReady(st, req);
  return (
    <>
      {blocked && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-[15] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="sharing-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 id="sharing-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                  {st.displays === 'extended' && req.screen && st.screen === 'live' ? 'Lepas monitor tambahan' : 'Pengawasan terhenti'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Soal ditutup sampai {req.camera && req.screen ? 'kamera dan layar' : req.camera ? 'kamera' : 'layar'} dibagikan lagi. Waktu tetap berjalan; jawaban Anda aman. Kejadian ini tercatat oleh
                  pengawas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {req.camera && st.camera !== 'live' && (
                <Button loading={act.busy === 'camera'} icon={<Camera className="h-4 w-4" />} onClick={() => void act.camera()}>
                  Nyalakan kamera
                </Button>
              )}
              {req.screen && st.screen !== 'live' && (
                <Button loading={act.busy === 'screen'} icon={<ScreenShare className="h-4 w-4" />} onClick={() => void act.screen()}>
                  Bagikan seluruh layar
                </Button>
              )}
            </div>
            {req.screen && <DisplayWarning st={st} />}
            {act.error && <Alert>{act.error}</Alert>}
          </div>
        </div>
      )}
      {running && (req.camera || viewers > 0) && (
        <div className="fixed bottom-4 right-4 z-[16] flex flex-col items-end gap-1.5">
          {viewers > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white shadow" role="status">
              <Eye className="h-3.5 w-3.5" /> Pengawas sedang melihat
            </span>
          )}
          {req.camera && (
            <button type="button" onClick={() => setSmall((v) => !v)} aria-label={small ? 'Perbesar pratinjau kamera' : 'Perkecil pratinjau kamera'} className="rounded-lg shadow-lg ring-2 ring-white dark:ring-slate-800">
              <CameraPreview className={small ? 'h-12 w-16' : 'h-24 w-32'} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
