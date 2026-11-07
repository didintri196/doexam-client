/**
 * LiveViewModal shows a participant's screen and camera on demand (DOCS/PLAN/19 §5). Opening it
 * asks the participant's exam client to start sending, peer-to-peer (WebRTC): the server only
 * relays the offer/answer/ICE messages. Closing it (or 10 minutes) stops the stream.
 */
import { Camera, MonitorOff, RefreshCw, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import type { LiveView, Signal } from '@/shared/api/types';
import { errorMessage } from '@/shared/lib/errors';
import { formatClock } from '@/shared/lib/format';
import { Alert, Badge, Button, Modal } from '@/shared/ui';
import { sessionApi } from '../api';

type Phase = 'opening' | 'waiting' | 'connecting' | 'live' | 'ended' | 'failed';
const OFFER_TIMEOUT_MS = 15_000;

const phaseText: Record<Phase, string> = {
  opening: 'Membuka tayangan…',
  waiting: 'Menunggu peserta…',
  connecting: 'Menyambungkan…',
  live: 'Langsung',
  ended: 'Tayangan berakhir',
  failed: 'Tidak tersambung',
};

export function LiveViewModal({ sessionId, attemptId, name, onClose }: { sessionId: string; attemptId: string; name: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<LiveView | null>(null);
  const [round, setRound] = useState(0); // "Sambung lagi" opens a new view
  const [left, setLeft] = useState<number | null>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stopped = false;
    const conn: { pc: RTCPeerConnection | null } = { pc: null };
    let viewId: string | null = null;
    const pending: RTCIceCandidateInit[] = [];
    setPhase('opening');
    setError(null);

    const fail = (msg: string) => {
      if (stopped) return;
      setError(msg);
      setPhase('failed');
    };

    const onOffer = async (v: LiveView, s: Signal) => {
      const pc = new RTCPeerConnection({ iceServers: v.ice_servers });
      conn.pc = pc;
      const ids = (s.payload.streams ?? {}) as { camera?: string; screen?: string };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;
        const el = stream.id === ids.camera ? cameraRef.current : stream.id === ids.screen ? screenRef.current : ids.screen ? cameraRef.current : screenRef.current;
        if (el && el.srcObject !== stream) el.srcObject = stream;
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void sessionApi.liveSignal(sessionId, v.id, 'ice', { candidate: e.candidate.toJSON() }).catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (stopped) return;
        if (pc.connectionState === 'connected') setPhase('live');
        if (pc.connectionState === 'failed') fail('Koneksi ke perangkat peserta gagal. Di luar jaringan sekolah, server perlu STUN/TURN (ICE_SERVERS).');
      };
      setPhase('connecting');
      await pc.setRemoteDescription({ type: 'offer', sdp: String(s.payload.sdp ?? '') });
      for (const c of pending.splice(0)) await pc.addIceCandidate(c);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sessionApi.liveSignal(sessionId, v.id, 'answer', { type: answer.type, sdp: answer.sdp });
    };

    void (async () => {
      let v: LiveView;
      try {
        v = await sessionApi.liveOpen(sessionId, attemptId);
      } catch (e) {
        fail(errorMessage(e));
        return;
      }
      if (stopped) {
        void sessionApi.liveClose(sessionId, v.id).catch(() => {});
        return;
      }
      viewId = v.id;
      setView(v);
      setPhase('waiting');
      const noOffer = setTimeout(() => {
        if (!conn.pc) fail('Peserta tidak merespons. Mungkin perangkatnya offline, atau kamera/layar sedang tidak dibagikan.');
      }, OFFER_TIMEOUT_MS);
      let cursor = 0;
      try {
        while (!stopped) {
          const poll = await sessionApi.liveSignals(sessionId, v.id, cursor, 25);
          cursor = poll.cursor;
          for (const s of poll.signals) {
            if (stopped) break;
            if (s.kind === 'offer' && !conn.pc) await onOffer(v, s);
            else if (s.kind === 'ice' && s.payload.candidate) {
              const c = s.payload.candidate as RTCIceCandidateInit;
              if (conn.pc?.remoteDescription) await conn.pc.addIceCandidate(c);
              else pending.push(c);
            }
          }
          if (poll.ended) {
            if (!stopped) setPhase('ended');
            break;
          }
        }
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) fail(errorMessage(e));
        else if (!stopped) setPhase('ended');
      } finally {
        clearTimeout(noOffer);
        conn.pc?.close();
      }
    })();

    return () => {
      stopped = true;
      conn.pc?.close();
      if (viewId) void sessionApi.liveClose(sessionId, viewId).catch(() => {});
    };
  }, [sessionId, attemptId, round]);

  // countdown to the automatic end
  useEffect(() => {
    if (!view) return;
    const tick = () => setLeft(Math.max(0, (Date.parse(view.expires_at) - Date.now()) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [view]);

  const done = phase === 'ended' || phase === 'failed';
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Video className="h-4 w-4 text-slate-400" /> {name}
          <Badge tone={phase === 'live' ? 'red' : done ? 'slate' : 'amber'}>{phaseText[phase]}</Badge>
          {phase === 'live' && left !== null && <span className="text-xs font-normal tabular-nums text-slate-500">berakhir dalam {formatClock(left)}</span>}
        </span>
      }
      footer={
        <>
          {done && (
            <Button variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setRound((r) => r + 1)}>
              Sambung lagi
            </Button>
          )}
          <Button onClick={onClose}>Tutup</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <div className="relative overflow-hidden rounded-xl bg-slate-950">
          <video ref={screenRef} autoPlay muted playsInline className="aspect-video w-full object-contain" aria-label={`Layar ${name}`} />
          {(!view || !view.screen) && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              <MonitorOff className="mr-2 h-4 w-4" /> {view ? 'Sesi ini tidak mewajibkan berbagi layar' : 'Belum ada gambar'}
            </div>
          )}
          {view?.camera && (
            <video ref={cameraRef} autoPlay muted playsInline className="absolute bottom-3 right-3 h-28 w-40 rounded-lg bg-slate-800 object-cover ring-2 ring-white/70" aria-label={`Kamera ${name}`} />
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Camera className="h-3.5 w-3.5" /> Tayangan langsung dari perangkat peserta, tidak direkam. Peserta melihat tanda &quot;Pengawas sedang melihat&quot;. Tercatat di log audit.
        </p>
      </div>
    </Modal>
  );
}
