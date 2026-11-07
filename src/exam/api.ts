import { api } from '@/shared/api/client';
import type { AttemptResult, AttemptView, ClientEvent, MyAnnouncements, MyAttempt, MySession, SignalKind, SignalPoll, SyncResult } from '@/shared/api/types';

export const examApi = {
  mySessions: () => api.get<MySession[]>('/my/sessions'),
  myAttempts: () => api.get<MyAttempt[]>('/my/attempts'),
  start: (session_id: string, token?: string) => api.post<AttemptView>('/attempts', { session_id, ...(token ? { token } : {}) }),
  get: (id: string) => api.get<AttemptView>(`/attempts/${id}`),
  sync: (id: string, events: ClientEvent[]) => api.post<SyncResult>(`/attempts/${id}/events`, { events }),
  finishSection: (id: string, sectionId: string) => api.post<AttemptView>(`/attempts/${id}/sections/${sectionId}/finish`),
  submit: (id: string) => api.post<AttemptResult>(`/attempts/${id}/submit`),
  result: (id: string) => api.get<AttemptResult>(`/attempts/${id}/result`),
  announcements: (sessionId: string) => api.get<MyAnnouncements>(`/my/announcements?session_id=${encodeURIComponent(sessionId)}`),
  readAnnouncement: (id: string) => api.post<null>(`/my/announcements/${id}/read`),
  /** Live views (DOCS/PLAN/19): long-poll for proctor requests, and the WebRTC answer path. */
  signals: (id: string, after: number, wait: number) => api.get<SignalPoll>(`/attempts/${id}/signal`, { after, wait }),
  signal: (id: string, view_id: string, kind: SignalKind, payload: unknown = {}) => api.post<null>(`/attempts/${id}/signal`, { view_id, kind, payload }),
};
