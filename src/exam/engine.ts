import { useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError } from '@/shared/api/client';
import type { AttemptStatus, AttemptView, EventType, ItemView, MediaEventType, MyAnnouncement, Response, SectionView } from '@/shared/api/types';
import { examApi } from './api';
import { store, type LocalAttempt, type OutboxEvent } from './db';
import { clearMediaCache, prefetchMedia, type MediaProgress } from './mediaCache';

// AttemptEngine runs one attempt in the browser (09-FRONTEND §5.2–5.3):
// - every action becomes an event in the IndexedDB outbox and updates the UI at once;
// - the outbox is sent in batches (≤ 200) with backoff; resending is safe (idempotent ids);
// - the timer follows the server clock (offset from server_time), never the device clock;
// - a refresh or a dropped network resumes from the local copy.

const BATCH = 200;
const DEBOUNCE_MS = 1000;
const HEARTBEAT_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

export interface FlatItem extends ItemView {
  sectionId: string;
  number: number; // 1-based, across the visible sections
}

export interface Notice {
  tone: 'amber' | 'red' | 'blue';
  message: string;
}

export interface Snapshot {
  phase: 'loading' | 'ready' | 'error' | 'done';
  error?: string;
  view?: AttemptView;
  items: FlatItem[];
  responses: Record<string, Response | null>;
  flags: Record<string, boolean>;
  current?: string;
  furthest: number; // highest index reached (forward-only navigation)
  status?: AttemptStatus;
  deadlineMs: number; // effective deadline (attempt or active section), server clock
  offsetMs: number; // server time − local time
  pending: number;
  online: boolean;
  syncing: boolean;
  lastSyncAt?: number;
  expired: boolean;
  notice?: Notice;
  focusLost: number;
  /** Download of the attempt's pictures for offline use. */
  media?: MediaProgress;
  /** Audio plays used per media id, and extra plays granted by the proctor. */
  plays: Record<string, number>;
  extraPlays: number;
  /** Announcements of the session for this participant (newest first). */
  announcements: MyAnnouncement[];
}

const rejectMessages: Record<string, string> = {
  locked: 'Jawaban tidak tersimpan: ujian sedang dikunci pengawas.',
  section_closed: 'Bagian ini sudah ditutup; jawaban di bagian itu tidak lagi diterima.',
  forward_only: 'Soal yang sudah dilewati tidak bisa dijawab lagi.',
  after_deadline: 'Jawaban setelah waktu habis tidak dihitung.',
};

export function isAnswered(r: Response | null | undefined): boolean {
  if (!r) return false;
  if ('text' in r) return r.text.trim() !== '';
  if ('selected' in r) return Array.isArray(r.selected) ? r.selected.length > 0 : r.selected !== '';
  return 'value' in r;
}

function flatten(view: AttemptView): FlatItem[] {
  const out: FlatItem[] = [];
  const sections = [...view.sections].sort((a, b) => a.sort_order - b.sort_order);
  for (const s of sections) {
    if (!s.items) continue;
    for (const it of [...s.items].sort((a, b) => a.position - b.position)) {
      out.push({ ...it, sectionId: s.id, number: out.length + 1 });
    }
  }
  return out;
}

export function activeSection(view?: AttemptView): SectionView | undefined {
  return view?.sections.find((s) => s.state === 'active' && s.deadline_at) ?? view?.sections.find((s) => s.state === 'active');
}

function effectiveDeadline(view: AttemptView): number {
  let d = Date.parse(view.deadline_at);
  for (const s of view.sections) {
    if (s.state === 'active' && s.deadline_at) d = Math.min(d, Date.parse(s.deadline_at));
  }
  return d;
}

/** unreachable: no network, or the proxy answers but the server behind it does not (5xx). */
function unreachable(err: unknown): boolean {
  return err instanceof ApiError && (err.isNetwork || err.status >= 500);
}

const closed = (s?: AttemptStatus) => s === 'submitted' || s === 'graded' || s === 'void';

export class AttemptEngine {
  private snap: Snapshot = {
    phase: 'loading',
    items: [],
    responses: {},
    flags: {},
    furthest: 0,
    deadlineMs: 0,
    offsetMs: 0,
    pending: 0,
    online: navigator.onLine,
    syncing: false,
    expired: false,
    focusLost: 0,
    plays: {},
    extraPlays: 0,
    announcements: [],
  };
  private listeners = new Set<() => void>();
  private seq = 0;
  private viewStartedAt = Date.now();
  private syncTimer?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private clock?: ReturnType<typeof setInterval>;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private backoff = 0;
  private inFlight: Promise<void> | null = null;
  private disposed = false;
  private expiring = false;
  private prefetched = new Set<string>();
  private announcementCursor?: string;
  private readLocal = new Set<string>();
  private loadingAnnouncements = false;

  constructor(public readonly attemptId: string) {}

  // ── store plumbing ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** remainingSeconds uses the server clock. */
  remainingSeconds(now = Date.now()): number {
    return Math.max(0, Math.floor((this.snap.deadlineMs - (now + this.snap.offsetMs)) / 1000));
  }

  // ── lifecycle ────────────────────────────────────────────────
  async load(initial?: AttemptView) {
    const local = await store.getAttempt(this.attemptId).catch(() => undefined);
    this.seq = local?.seq ?? 0;
    // the view handed over by the start dialog is only fresh on first entry: history state
    // survives a reload, so with a local copy the server (or that copy) is the source
    let view = local ? undefined : initial;
    if (!view) {
      try {
        view = await examApi.get(this.attemptId);
      } catch (err) {
        if (!unreachable(err) || !local) {
          this.set({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
          return;
        }
      }
    }
    const pending = await store.pending(this.attemptId).catch(() => [] as OutboxEvent[]);
    if (local) {
      this.announcementCursor = local.announcement_cursor;
      this.readLocal = new Set(local.read_announcements ?? []);
      this.set({ announcements: local.announcements ?? [] });
    }
    if (view) {
      this.applyView(view, local, pending);
    } else if (local) {
      // offline: continue from the local copy
      this.applyView(local.view, local, pending, true);
      this.set({ online: false });
    }
    if (this.snap.phase === 'done') return;
    this.clock = setInterval(() => this.onTick(), 1000);
    this.heartbeat = setInterval(() => void this.sync(), HEARTBEAT_MS);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    if (pending.length) this.scheduleSync(0);
    void this.refreshAnnouncements();
  }

  dispose() {
    this.disposed = true;
    clearInterval(this.clock);
    clearInterval(this.heartbeat);
    clearTimeout(this.syncTimer);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    this.flushSave();
  }

  private onOnline = () => {
    this.set({ online: true });
    this.backoff = 0;
    this.scheduleSync(0);
  };
  private onOffline = () => this.set({ online: false });

  /** applyView merges a server view with local state (answers not yet synced win). */
  private applyView(view: AttemptView, local: LocalAttempt | undefined, pending: OutboxEvent[], fromLocal = false) {
    const items = flatten(view);
    const responses: Record<string, Response | null> = {};
    const flags: Record<string, boolean> = {};
    for (const it of items) {
      responses[it.id] = it.response;
      flags[it.id] = it.flagged;
    }
    if (fromLocal && local) {
      Object.assign(responses, local.responses);
      Object.assign(flags, local.flags);
    }
    for (const ev of pending) {
      if (!ev.attempt_item_id) continue;
      if (ev.type === 'RESPONSE_SAVED') responses[ev.attempt_item_id] = (ev.payload as { response: Response | null }).response;
      if (ev.type === 'FLAG_SET') flags[ev.attempt_item_id] = (ev.payload as { flagged: boolean }).flagged;
    }
    // Plays never go back: the server count plus clips started but not synced yet, or
    // what this device already counted, whichever is higher.
    const plays: Record<string, number> = { ...(view.media_plays ?? {}) };
    for (const ev of pending) {
      const id = ev.type === 'MEDIA_PLAYED' ? (ev.payload as { media_id?: string }).media_id : undefined;
      if (id) plays[id] = (plays[id] ?? 0) + 1;
    }
    for (const src of [local?.plays, this.snap.plays]) {
      for (const [id, n] of Object.entries(src ?? {})) plays[id] = Math.max(plays[id] ?? 0, n);
    }
    const prevCurrent = this.snap.current ?? local?.current;
    const current = items.find((i) => i.id === prevCurrent)?.id ?? items[0]?.id;
    const idx = Math.max(0, items.findIndex((i) => i.id === current));
    const offsetMs = fromLocal ? this.snap.offsetMs : Date.parse(view.server_time) - Date.now();
    this.set({
      phase: closed(view.status) ? 'done' : 'ready',
      view,
      items,
      responses,
      flags,
      current,
      furthest: this.snap.items[0]?.id === items[0]?.id ? Math.max(this.snap.furthest, idx) : idx,
      status: view.status,
      deadlineMs: effectiveDeadline(view),
      offsetMs,
      pending: pending.length,
      plays,
      extraPlays: Math.max(view.extra_plays ?? 0, fromLocal ? this.snap.extraPlays : 0),
    });
    if (closed(view.status)) {
      void store.clearAttempt(this.attemptId);
      void clearMediaCache();
    } else {
      this.save();
      if (!fromLocal) this.prefetch(view);
    }
  }

  /** prefetch downloads the pictures of the delivered items that are not cached yet. */
  private prefetch(view: AttemptView) {
    const fresh = Object.entries(view.media ?? {}).filter(([id]) => !this.prefetched.has(id));
    if (!fresh.length) return;
    fresh.forEach(([id]) => this.prefetched.add(id));
    void prefetchMedia(
      fresh.map(([, ref]) => ref.url),
      (media) => !this.disposed && this.set({ media }),
    ).then((done) => {
      // failed downloads are retried with the next view (section change, reload)
      if (done.failed) fresh.forEach(([id]) => this.prefetched.delete(id));
    });
  }

  private save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 300);
  }
  private flushSave() {
    const s = this.snap;
    if (!s.view || closed(s.status)) return;
    void store
      .putAttempt({
        id: this.attemptId,
        view: s.view,
        responses: s.responses,
        flags: s.flags,
        current: s.current,
        seq: this.seq,
        plays: s.plays,
        announcements: s.announcements,
        announcement_cursor: this.announcementCursor,
        read_announcements: [...this.readLocal],
        saved_at: Date.now(),
      })
      .catch(() => {});
  }

  // ── actions ──────────────────────────────────────────────────
  get canAnswer() {
    return this.snap.phase === 'ready' && this.snap.status === 'in_progress' && !this.snap.expired;
  }

  answer(itemId: string, response: Response | null) {
    if (!this.canAnswer) return;
    this.set({ responses: { ...this.snap.responses, [itemId]: response } });
    void this.enqueue('RESPONSE_SAVED', { response }, itemId);
  }

  flag(itemId: string, flagged: boolean) {
    if (!this.canAnswer) return;
    this.set({ flags: { ...this.snap.flags, [itemId]: flagged } });
    void this.enqueue('FLAG_SET', { flagged }, itemId);
  }

  /**
   * recordPlay counts the start of an audio clip and returns the play number, or 0 when
   * playing is not allowed now. The limit itself is checked by the player.
   */
  recordPlay(mediaId: string): number {
    if (!this.canAnswer) return 0;
    const n = (this.snap.plays[mediaId] ?? 0) + 1;
    this.set({ plays: { ...this.snap.plays, [mediaId]: n } });
    void this.enqueue('MEDIA_PLAYED', { media_id: mediaId, play_no: n });
    return n;
  }

  /** goTo moves to another item, recording time spent on the one being left. */
  goTo(itemId: string) {
    const s = this.snap;
    if (itemId === s.current) return;
    const idx = s.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    if (s.view?.navigation === 'forward_only' && idx < s.furthest) return;
    if (s.current && s.status === 'in_progress') {
      void this.enqueue('ITEM_VIEWED', { time_spent_ms: Date.now() - this.viewStartedAt }, s.current);
    }
    this.viewStartedAt = Date.now();
    this.set({ current: itemId, furthest: Math.max(s.furthest, idx) });
    this.save();
  }

  recordFocus(type: 'FOCUS_LOST' | 'FOCUS_RETURNED' | 'FULLSCREEN_EXIT') {
    if (this.snap.status !== 'in_progress') return;
    if (type === 'FOCUS_LOST') this.set({ focusLost: this.snap.focusLost + 1 });
    void this.enqueue(type, {});
  }

  /** recordMedia logs a camera/screen/display change (DOCS/PLAN/19 §4.2) through the outbox. */
  recordMedia(type: MediaEventType) {
    if (this.snap.status !== 'in_progress') return;
    void this.enqueue(type, {});
  }

  dismissNotice() {
    this.set({ notice: undefined });
  }

  /**
   * confirmAnnouncement marks an announcement as read at once and sends the confirmation
   * through the outbox (ANNOUNCEMENT_READ), so it survives a dropped network.
   */
  confirmAnnouncement(id: string) {
    const a = this.snap.announcements.find((x) => x.id === id);
    if (!a || a.read_at) return;
    this.readLocal.add(id);
    const at = new Date(Date.now() + this.snap.offsetMs).toISOString();
    this.set({ announcements: this.snap.announcements.map((x) => (x.id === id ? { ...x, read_at: at } : x)) });
    if (closed(this.snap.status)) void examApi.readAnnouncement(id).catch(() => {});
    else void this.enqueue('ANNOUNCEMENT_READ', { announcement_id: id });
    this.save();
  }

  /** refreshAnnouncements reloads the list (start, or when the heartbeat's cursor changed). */
  private async refreshAnnouncements() {
    const sessionId = this.snap.view?.session_id;
    if (!sessionId || this.loadingAnnouncements || this.disposed) return;
    this.loadingAnnouncements = true;
    try {
      const res = await examApi.announcements(sessionId);
      const list = res.announcements.map((a) => {
        if (a.read_at) this.readLocal.delete(a.id);
        // confirmed here but not synced yet: keep it read
        return !a.read_at && this.readLocal.has(a.id) ? { ...a, read_at: this.snap.announcements.find((x) => x.id === a.id)?.read_at ?? new Date().toISOString() } : a;
      });
      this.announcementCursor = res.cursor;
      this.set({ announcements: list });
      this.save();
    } catch {
      /* offline: keep the local list; the next heartbeat tries again */
    } finally {
      this.loadingAnnouncements = false;
    }
  }

  private nextSeq() {
    // client_seq is a 32-bit int on the server; seconds since epoch keep it increasing
    // even if this device's storage was wiped and the attempt resumed elsewhere.
    this.seq = Math.max(this.seq + 1, Math.floor(Date.now() / 1000));
    return this.seq;
  }

  private async enqueue(type: EventType, payload: unknown, attemptItemId?: string) {
    const ev: OutboxEvent = {
      attempt_id: this.attemptId,
      client_event_id: crypto.randomUUID(),
      client_seq: this.nextSeq(),
      type,
      payload,
      client_ts: new Date(Date.now() + this.snap.offsetMs).toISOString(),
      ...(attemptItemId ? { attempt_item_id: attemptItemId } : {}),
    };
    this.set({ pending: this.snap.pending + 1 });
    this.save();
    try {
      await store.enqueue(ev);
    } catch {
      this.set({ notice: { tone: 'red', message: 'Penyimpanan lokal browser penuh atau diblokir. Jangan tutup halaman ini.' } });
    }
    this.scheduleSync(DEBOUNCE_MS);
  }

  // ── sync ─────────────────────────────────────────────────────
  private scheduleSync(delay: number) {
    if (this.disposed) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.sync(), delay);
  }

  /** sync sends the outbox (or a heartbeat) until it is empty. */
  sync(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.doSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doSync() {
    if (this.disposed || closed(this.snap.status)) return;
    this.set({ syncing: true });
    try {
      for (;;) {
        const pending = await store.pending(this.attemptId);
        const batch = pending.slice(0, BATCH);
        const res = await examApi.sync(
          this.attemptId,
          batch.map(({ attempt_id: _a, ...ev }) => ev),
        );
        await store.remove(batch.map((e) => e.client_event_id));
        const left = pending.length - batch.length;
        this.backoff = 0;
        const rejected = res.rejected ?? [];
        const reasons = new Set(rejected.map((r) => r.reason));
        const msg = [...reasons].map((r) => rejectMessages[r]).find(Boolean);
        this.set({
          pending: left,
          online: true,
          lastSyncAt: Date.now(),
          status: res.status,
          offsetMs: Date.parse(res.server_time) - Date.now(),
          deadlineMs: this.snap.view ? Math.min(Date.parse(res.deadline_at), this.sectionDeadline()) : Date.parse(res.deadline_at),
          ...(msg ? { notice: { tone: 'amber' as const, message: msg } } : {}),
        });
        if ((res.announcement_cursor ?? '') !== (this.announcementCursor ?? '')) void this.refreshAnnouncements();
        if (closed(res.status)) {
          await this.finish();
          return;
        }
        if (reasons.has('section_closed')) await this.reload();
        if (left === 0) break;
      }
    } catch (err) {
      this.onSyncError(err);
    } finally {
      this.set({ syncing: false });
    }
  }

  private sectionDeadline(): number {
    const s = this.snap.view?.sections.find((x) => x.state === 'active' && x.deadline_at);
    return s?.deadline_at ? Date.parse(s.deadline_at) : Number.POSITIVE_INFINITY;
  }

  private onSyncError(err: unknown) {
    if (err instanceof ApiError && !err.isNetwork && err.status < 500) {
      if (err.status === 409 && err.message.startsWith('this attempt is bound to another device')) {
        this.set({ notice: { tone: 'red', message: 'Ujian ini terkunci di perangkat lain. Minta pengawas me-reset perangkat.' } });
        return;
      }
      if (err.status === 401) return; // the auth layer sends the user to the login page
      void this.reload();
      return;
    }
    // network or server trouble: keep the outbox, retry with backoff
    this.backoff = Math.min(MAX_BACKOFF_MS, this.backoff ? this.backoff * 2 : 2000);
    this.set({ online: unreachable(err) ? false : this.snap.online });
    this.scheduleSync(this.backoff);
  }

  /** reload fetches the view again (section changes, proctor actions). */
  async reload() {
    try {
      const view = await examApi.get(this.attemptId);
      const pending = await store.pending(this.attemptId);
      this.applyView(view, undefined, pending);
      if (closed(view.status)) await this.finish();
    } catch {
      /* keep the current state; the next sync retries */
    }
  }

  private async finish() {
    clearInterval(this.clock);
    clearInterval(this.heartbeat);
    await store.clearAttempt(this.attemptId).catch(() => {});
    await clearMediaCache();
    this.set({ phase: 'done' });
  }

  private onTick() {
    // the timer component renders itself every second; here we only watch for the end
    if (this.snap.status === 'in_progress' && !this.snap.expired && this.remainingSeconds() <= 0) {
      void this.expire();
    }
  }

  /** expire: time is up on the server clock. Send what is left, then close. */
  private async expire() {
    if (this.expiring) return;
    this.expiring = true;
    const section = activeSection(this.snap.view);
    const sectionEnds = section?.deadline_at && Date.parse(section.deadline_at) < Date.parse(this.snap.view!.deadline_at);
    this.set({ expired: !sectionEnds });
    await this.sync();
    try {
      if (sectionEnds && section) {
        // sequential mode: the section's time is up, the next section starts
        const view = await examApi.finishSection(this.attemptId, section.id).catch(() => examApi.get(this.attemptId));
        this.applyView(view, undefined, await store.pending(this.attemptId));
        if (closed(view.status)) await this.finish();
      } else {
        await examApi.submit(this.attemptId);
        await this.finish();
      }
    } catch (err) {
      if (unreachable(err)) {
        this.set({ online: false, notice: { tone: 'amber', message: 'Waktu habis. Jawaban tersimpan di perangkat dan akan dikirim saat koneksi kembali.' } });
      } else {
        await this.reload();
      }
    } finally {
      this.expiring = false;
    }
  }

  /** finishSection closes the current section (sequential mode) after syncing. */
  async finishSection(sectionId: string) {
    await this.sync();
    if (this.snap.pending > 0) throw new ApiError(0, 'network error');
    const view = await examApi.finishSection(this.attemptId, sectionId);
    this.applyView(view, undefined, []);
    this.viewStartedAt = Date.now();
    if (closed(view.status)) await this.finish();
  }

  /** submit sends everything, then submits. Refuses while answers are still only local. */
  async submit() {
    if (this.snap.current && this.snap.status === 'in_progress') {
      await this.enqueue('ITEM_VIEWED', { time_spent_ms: Date.now() - this.viewStartedAt }, this.snap.current);
    }
    await this.sync();
    if (this.snap.pending > 0) throw new ApiError(0, 'network error');
    await examApi.submit(this.attemptId);
    await this.finish();
  }
}


const idle: Snapshot = {
  phase: 'loading', items: [], responses: {}, flags: {}, furthest: 0, deadlineMs: 0, offsetMs: 0,
  pending: 0, online: true, syncing: false, expired: false, focusLost: 0, plays: {}, extraPlays: 0, announcements: [],
};
const noop = () => () => {};

/** useAttemptEngine creates the engine for one attempt and follows its snapshot. */
export function useAttemptEngine(attemptId: string, initial?: AttemptView): [AttemptEngine | null, Snapshot] {
  const [engine, setEngine] = useState<AttemptEngine | null>(null);
  useEffect(() => {
    const e = new AttemptEngine(attemptId);
    setEngine(e);
    void e.load(initial);
    return () => e.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);
  const snap = useSyncExternalStore(engine?.subscribe ?? noop, engine?.getSnapshot ?? (() => idle));
  return [engine, snap];
}
