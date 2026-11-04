import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AttemptView, ClientEvent, MyAnnouncement, Response } from '@/shared/api/types';

// Local exam storage (IndexedDB): the outbox of events not yet accepted by the server and
// the last known state of each attempt, so a refresh or a dropped network loses nothing.

export interface OutboxEvent extends ClientEvent {
  attempt_id: string;
}

export interface LocalAttempt {
  id: string;
  view: AttemptView; // last view from the server
  responses: Record<string, Response | null>; // local answers (newest)
  flags: Record<string, boolean>;
  current?: string; // attempt item id on screen
  seq: number; // last client_seq used
  plays?: Record<string, number>; // audio plays used per media id
  announcements?: MyAnnouncement[]; // last list from the server, local confirmations applied
  announcement_cursor?: string;
  read_announcements?: string[]; // confirmed here, not yet shown as read by the server
  saved_at: number;
}

interface ExamDB extends DBSchema {
  outbox: { key: string; value: OutboxEvent; indexes: { by_attempt: string } };
  attempts: { key: string; value: LocalAttempt };
}

let dbPromise: Promise<IDBPDatabase<ExamDB>> | null = null;

function db() {
  dbPromise ??= openDB<ExamDB>('doexam-exam', 1, {
    upgrade(d) {
      const out = d.createObjectStore('outbox', { keyPath: 'client_event_id' });
      out.createIndex('by_attempt', 'attempt_id');
      d.createObjectStore('attempts', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export const store = {
  async pending(attemptId: string): Promise<OutboxEvent[]> {
    const all = await (await db()).getAllFromIndex('outbox', 'by_attempt', attemptId);
    return all.sort((a, b) => a.client_seq - b.client_seq);
  },
  async enqueue(ev: OutboxEvent) {
    await (await db()).put('outbox', ev);
  },
  async remove(ids: string[]) {
    const tx = (await db()).transaction('outbox', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  },
  async clearAttempt(attemptId: string) {
    const d = await db();
    const keys = await d.getAllKeysFromIndex('outbox', 'by_attempt', attemptId);
    const tx = d.transaction(['outbox', 'attempts'], 'readwrite');
    await Promise.all([...keys.map((k) => tx.objectStore('outbox').delete(k)), tx.objectStore('attempts').delete(attemptId), tx.done]);
  },
  async getAttempt(id: string) {
    return (await db()).get('attempts', id);
  },
  async putAttempt(a: LocalAttempt) {
    await (await db()).put('attempts', a);
  },
};
