/**
 * Camera and whole-screen sharing required by a session (DOCS/PLAN/19-LIHAT-LAYAR-KAMERA.md §4).
 *
 * The streams live here, outside React, so they survive the move from the start dialog to the
 * exam page. They never leave the browser on their own: video is only sent when a proctor opens
 * a live view (see liveview.ts). A page reload loses them; the exam page then asks again.
 */
import { useSyncExternalStore } from 'react';

export type Displays = 'single' | 'extended' | 'unknown';
export interface MediaStatus {
  camera: 'live' | 'off';
  screen: 'live' | 'off';
  displays: Displays;
}

/** MediaProblem carries a message to show the participant as is. */
export class MediaProblem extends Error {}

// Window Management API (Chrome/Edge): isExtended + a "change" event when displays change.
type ScreenWithExtended = Screen & {
  isExtended?: boolean;
  addEventListener?: (type: 'change', fn: () => void) => void;
  removeEventListener?: (type: 'change', fn: () => void) => void;
};

const cameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } },
};

// Chrome/Edge read the extra options: "Entire screen" first, the exam tab hidden from the list,
// and no switching source mid-way. Other browsers ignore them; the surface is checked anyway.
const screenConstraints = {
  audio: false,
  video: { displaySurface: 'monitor', frameRate: { ideal: 5, max: 5 } },
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'exclude',
  monitorTypeSurfaces: 'include',
} as DisplayMediaStreamOptions;

class MediaGuard {
  camera: MediaStream | null = null;
  screen: MediaStream | null = null;
  private snap: MediaStatus = { camera: 'off', screen: 'off', displays: readDisplays() };
  private listeners = new Set<() => void>();
  private watching = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  getSnapshot = () => this.snap;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** What this browser can do; the exam needs a secure origin (HTTPS) for both. */
  support() {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    return {
      secure: typeof window !== 'undefined' && window.isSecureContext,
      camera: !!md?.getUserMedia,
      screen: !!md?.getDisplayMedia,
    };
  }

  async startCamera() {
    if (live(this.camera)) return;
    const s = this.support();
    if (!s.secure) throw new MediaProblem(insecure);
    if (!s.camera) throw new MediaProblem('Browser ini tidak bisa memakai kamera. Gunakan Chrome atau Edge terbaru.');
    try {
      this.camera = await navigator.mediaDevices.getUserMedia(cameraConstraints);
    } catch (e) {
      throw new MediaProblem(cameraError(e));
    }
    this.watchEnd(this.camera);
    this.update();
  }

  async startScreen() {
    if (live(this.screen)) return;
    const s = this.support();
    if (!s.secure) throw new MediaProblem(insecure);
    if (!s.screen) throw new MediaProblem('Browser ini tidak bisa berbagi layar. Gunakan Chrome atau Edge di komputer.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);
    } catch (e) {
      throw new MediaProblem(name(e) === 'NotAllowedError' ? 'Berbagi layar dibatalkan. Pilih "Seluruh layar", lalu klik Bagikan.' : 'Berbagi layar gagal dimulai. Coba lagi.');
    }
    const surface = (stream.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    // only a browser that reports another surface is refused (some do not report it at all)
    if (surface && surface !== 'monitor') {
      stream.getTracks().forEach((t) => t.stop());
      throw new MediaProblem('Yang dibagikan harus "Seluruh layar", bukan tab atau jendela. Coba lagi dan pilih Seluruh layar.');
    }
    this.screen = stream;
    this.watchEnd(stream);
    this.update();
  }

  /** Re-reads the number of displays (after the participant unplugs one). */
  checkDisplays() {
    this.update();
    return this.snap.displays;
  }

  /** watchDisplays follows plugged/unplugged monitors while the exam runs. */
  watchDisplays() {
    this.watching++;
    if (this.watching === 1) {
      (screen as ScreenWithExtended).addEventListener?.('change', this.update);
      this.timer = setInterval(this.update, 5000);
    }
    return () => {
      this.watching--;
      if (this.watching === 0) {
        (screen as ScreenWithExtended).removeEventListener?.('change', this.update);
        clearInterval(this.timer);
      }
    };
  }

  /** stop ends both shares (the exam is over). */
  stop() {
    for (const s of [this.camera, this.screen]) s?.getTracks().forEach((t) => t.stop());
    this.camera = this.screen = null;
    this.update();
  }

  private watchEnd(stream: MediaStream) {
    for (const t of stream.getTracks()) t.addEventListener('ended', this.update);
  }

  private update = () => {
    const next: MediaStatus = { camera: live(this.camera) ? 'live' : 'off', screen: live(this.screen) ? 'live' : 'off', displays: readDisplays() };
    if (next.camera === this.snap.camera && next.screen === this.snap.screen && next.displays === this.snap.displays) return;
    this.snap = next;
    this.listeners.forEach((fn) => fn());
  };
}

const insecure = 'Kamera dan berbagi layar hanya bisa lewat alamat HTTPS. Minta panitia membuka ujian lewat https://…';

function live(s: MediaStream | null) {
  return !!s && s.getVideoTracks().some((t) => t.readyState === 'live');
}

function readDisplays(): Displays {
  if (typeof screen === 'undefined') return 'unknown';
  const ext = (screen as ScreenWithExtended).isExtended;
  return ext === undefined ? 'unknown' : ext ? 'extended' : 'single';
}

function name(e: unknown) {
  return e instanceof DOMException ? e.name : '';
}

function cameraError(e: unknown) {
  switch (name(e)) {
    case 'NotAllowedError':
      return 'Izin kamera ditolak. Klik ikon gembok/kamera di bilah alamat, izinkan kamera, lalu coba lagi.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan. Pasang kamera, lalu coba lagi.';
    case 'NotReadableError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.';
    default:
      return 'Kamera gagal dinyalakan. Coba lagi.';
  }
}

export const media = new MediaGuard();

/** useMedia re-renders on camera/screen/display changes. */
export function useMedia() {
  return useSyncExternalStore(media.subscribe, media.getSnapshot);
}

/** sharingReady: everything a session requires is live and no extra display is attached. */
export function sharingReady(st: MediaStatus, req: { camera: boolean; screen: boolean }) {
  return (!req.camera || st.camera === 'live') && (!req.screen || st.screen === 'live') && (!req.screen || st.displays !== 'extended');
}
