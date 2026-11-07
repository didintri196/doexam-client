/**
 * LiveSender answers proctors' live-view requests (DOCS/PLAN/19-LIHAT-LAYAR-KAMERA.md §4.3).
 *
 * It long-polls the server for "view_request" messages. For each one it opens a WebRTC
 * connection that sends the already shared camera/screen straight to that proctor, with low
 * frame rates and bitrates. Nothing is sent while no proctor is watching. Failures here never
 * touch answers, sync or submit.
 */
import { ApiError } from '@/shared/api/client';
import type { Signal } from '@/shared/api/types';
import { examApi } from './api';
import { media } from './media';

const POLL_WAIT = 25; // seconds, the server's maximum
const RETRY_MS = 5000;

interface Peer {
  pc: RTCPeerConnection;
  camera?: RTCRtpSender;
  screen?: RTCRtpSender;
  pending: RTCIceCandidateInit[]; // candidates that came before the answer
  timer: ReturnType<typeof setTimeout>;
}

export class LiveSender {
  private cursor = 0;
  private stopped = false;
  private peers = new Map<string, Peer>();
  private unsubscribe: () => void;

  constructor(
    private attemptId: string,
    private req: { camera: boolean; screen: boolean },
    private onViewers: (n: number) => void,
  ) {
    // a share started again (new stream) replaces the track in every open connection
    this.unsubscribe = media.subscribe(() => this.refreshTracks());
  }

  start() {
    void this.loop();
    return this;
  }

  stop() {
    this.stopped = true;
    this.unsubscribe();
    for (const id of [...this.peers.keys()]) this.close(id, true);
  }

  private async loop() {
    while (!this.stopped) {
      try {
        const poll = await examApi.signals(this.attemptId, this.cursor, POLL_WAIT);
        this.cursor = poll.cursor;
        // a view requested and ended in the same batch (proctor closed at once) is skipped
        const ended = new Set(poll.signals.filter((s) => s.kind === 'end').map((s) => s.view_id));
        for (const s of poll.signals) {
          if (s.kind === 'view_request' && ended.has(s.view_id)) continue;
          await this.handle(s);
        }
      } catch (e) {
        // 401/403/404/409: the attempt is gone or no longer shares; stop quietly
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) return;
        await sleep(RETRY_MS);
      }
    }
  }

  private async handle(s: Signal) {
    if (this.stopped) return;
    try {
      switch (s.kind) {
        case 'view_request':
          await this.open(s.view_id, s.payload);
          break;
        case 'answer': {
          const p = this.peers.get(s.view_id);
          if (!p) return;
          await p.pc.setRemoteDescription({ type: 'answer', sdp: String(s.payload.sdp ?? '') });
          for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c);
          break;
        }
        case 'ice': {
          const p = this.peers.get(s.view_id);
          const c = s.payload.candidate as RTCIceCandidateInit | undefined;
          if (!p || !c) return;
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(c);
          else p.pending.push(c);
          break;
        }
        case 'end':
          this.close(s.view_id, false);
          break;
      }
    } catch (e) {
      // a broken negotiation ends that view only; a view the server already ended needs no "end"
      this.close(s.view_id, !(e instanceof ApiError && e.status === 409));
    }
  }

  private async open(viewId: string, payload: Record<string, unknown>) {
    if (this.peers.has(viewId)) return; // already answered (cursor replay)
    const expires = Date.parse(String(payload.expires_at ?? ''));
    if (Number.isFinite(expires) && expires <= Date.now()) return; // stale request
    const pc = new RTCPeerConnection({ iceServers: (payload.ice_servers as RTCIceServer[] | undefined) ?? [] });
    const timer = setTimeout(() => this.close(viewId, false), Number.isFinite(expires) ? expires - Date.now() : 10 * 60_000);
    const peer: Peer = { pc, pending: [], timer };
    this.peers.set(viewId, peer);
    this.onViewers(this.peers.size);

    const streams: Record<string, string> = {};
    const cam = media.camera?.getVideoTracks()[0];
    if (this.req.camera && cam && media.camera) {
      peer.camera = pc.addTransceiver(cam, {
        direction: 'sendonly',
        streams: [media.camera],
        sendEncodings: [{ maxBitrate: 150_000, maxFramerate: 15 }],
      }).sender;
      streams.camera = media.camera.id;
    }
    const scr = media.screen?.getVideoTracks()[0];
    if (this.req.screen && scr && media.screen) {
      const w = scr.getSettings().width ?? 1280;
      peer.screen = pc.addTransceiver(scr, {
        direction: 'sendonly',
        streams: [media.screen],
        sendEncodings: [{ maxBitrate: 500_000, maxFramerate: 5, scaleResolutionDownBy: Math.max(1, w / 1280) }],
      }).sender;
      streams.screen = media.screen.id;
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) void examApi.signal(this.attemptId, viewId, 'ice', { candidate: e.candidate.toJSON() }).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.close(viewId, true);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await examApi.signal(this.attemptId, viewId, 'offer', { type: offer.type, sdp: offer.sdp, streams });
  }

  private refreshTracks() {
    for (const p of this.peers.values()) {
      const cam = media.camera?.getVideoTracks()[0] ?? null;
      const scr = media.screen?.getVideoTracks()[0] ?? null;
      if (p.camera && p.camera.track !== cam) void p.camera.replaceTrack(cam).catch(() => {});
      if (p.screen && p.screen.track !== scr) void p.screen.replaceTrack(scr).catch(() => {});
    }
  }

  private close(viewId: string, tell: boolean) {
    const p = this.peers.get(viewId);
    if (!p) return;
    this.peers.delete(viewId);
    clearTimeout(p.timer);
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    this.onViewers(this.peers.size);
    if (tell) void examApi.signal(this.attemptId, viewId, 'end').catch(() => {});
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
