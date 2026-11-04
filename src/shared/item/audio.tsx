import { Headphones, Pause, Play } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { cx } from '@/shared/ui';
import { useMedia } from './media';

/**
 * AudioPlays connects limited clips to the exam engine: how often each clip was played,
 * the plays granted by the proctor, and a way to count a new play. Without it (panel,
 * preview) clips render as ordinary players.
 */
export interface AudioPlays {
  used(mediaId: string): number;
  extra: number;
  canPlay: boolean;
  /** record counts a play that has just started. */
  record(mediaId: string): void;
}

export const AudioPlaysContext = createContext<AudioPlays | null>(null);

export function useAudioPlays(): AudioPlays | null {
  return useContext(AudioPlaysContext);
}

function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/**
 * LimitedAudio plays a clip at most `max` (+ granted) times. There is no seek bar, and
 * pausing is offered only when the item allows it. A play is counted once the clip has
 * actually started, so a clip that fails to load does not use up a play.
 */
export function LimitedAudio({ mediaId, max, allowPause }: { mediaId: string; max: number; allowPause: boolean }) {
  const plays = useAudioPlays();
  const media = useMedia();
  const ref = media.get(mediaId);
  const audio = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref) media.request([mediaId]);
  }, [ref, media, mediaId]);

  const used = plays?.used(mediaId) ?? 0;
  const limit = max + (plays?.extra ?? 0);
  const left = Math.max(0, limit - used);
  const exhausted = left === 0 && state === 'idle';

  const start = async () => {
    const a = audio.current;
    if (!a) return;
    if (state === 'paused') {
      await a.play().catch(() => setFailed(true));
      setState('playing');
      return;
    }
    if (left <= 0 || !plays?.canPlay) return;
    if (failed || a.error) a.load(); // "coba lagi": fetch the clip again before playing
    a.currentTime = 0;
    try {
      await a.play();
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    plays.record(mediaId);
    setState('playing');
  };

  const pause = () => {
    audio.current?.pause();
    setState('paused');
  };

  const label =
    state === 'playing'
      ? allowPause
        ? 'Jeda'
        : 'Sedang diputar'
      : state === 'paused'
        ? 'Lanjutkan'
        : used > 0
          ? 'Putar lagi'
          : 'Putar';
  const disabled = !ref || (state === 'playing' && !allowPause) || exhausted || (state === 'idle' && !plays?.canPlay);
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <span className="my-2 flex w-full max-w-xl flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
      <audio
        ref={audio}
        src={ref?.url}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setState('idle');
          setTime(0);
        }}
        onError={() => setFailed(true)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => (state === 'playing' ? (allowPause ? pause() : undefined) : void start())}
        disabled={disabled}
        className={cx(
          'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors',
          disabled
            ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            : 'bg-blue-600 text-accent-fg hover:bg-blue-700',
        )}
      >
        {state === 'playing' && allowPause ? <Pause className="h-4 w-4" /> : state === 'playing' ? <Headphones className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {exhausted ? 'Jatah putar habis' : label}
      </button>
      <span
        role="progressbar"
        aria-label="Posisi audio"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {clock(time)} / {clock(duration)}
      </span>
      <span className="w-full text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {failed ? (
          <span className="text-rose-600 dark:text-rose-400">Audio belum bisa diputar. Periksa speaker atau koneksi, lalu coba lagi.</span>
        ) : (
          <>
            Sisa putar <span className="font-semibold tabular-nums">{left}</span> dari {limit}
            {!allowPause && ' · tidak bisa dijeda'}
            {state === 'playing' && !allowPause && ' · tetap di soal ini sampai audio selesai'}
          </>
        )}
      </span>
    </span>
  );
}
