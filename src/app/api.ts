// Panel endpoints. Kept out of src/shared so the exam bundle never carries them.
import { api } from '@/shared/api/client';
import type * as T from '@/shared/api/types';

type Q = Record<string, string | number | boolean | undefined>;

export const setupApi = {
  setup: (body: {
    tenant_name: string;
    tenant_slug?: string;
    preset?: string;
    admin_username: string;
    admin_full_name: string;
    admin_email?: string;
    admin_password: string;
  }) => api.post<{ tenant: T.Tenant; admin: { id: string; username: string } }>('/setup', body),
};

export const tenantApi = {
  get: () => api.get<T.Tenant>('/tenant'),
  update: (body: Partial<{ name: string; timezone: string; locale: string; primary_color: string; tagline: string; letterhead: string; exam_rules: string }>) =>
    api.patch<T.Tenant>('/tenant', body),
  setLogo: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.put<T.Tenant>('/tenant/logo', f);
  },
  removeLogo: () => api.del<T.Tenant>('/tenant/logo'),
};

export const userApi = {
  roles: () => api.get<T.Role[]>('/roles'),
  list: (q: Q) => api.page<T.User>('/users', q),
  get: (id: string) => api.get<T.UserDetail>(`/users/${id}`),
  create: (body: { username: string; full_name: string; email?: string; external_id?: string; password?: string; role_codes: string[]; must_change_password?: boolean }) =>
    api.post<T.UserCreated>('/users', body),
  update: (id: string, body: Partial<{ full_name: string; email: string; external_id: string; status: T.UserStatus; role_codes: string[] }>) =>
    api.patch<T.User>(`/users/${id}`, body),
  remove: (id: string) => api.del(`/users/${id}`),
  resetPassword: (id: string) => api.post<{ temporary_password: string }>(`/users/${id}/reset-password`),
  /** Maps usernames, ID peserta or e-mails (case-insensitive) to users. Max 5000. */
  resolve: (identifiers: string[]) => api.post<T.ResolveResult>('/users/resolve', { identifiers }),
  /** Same as resolve, from an .xlsx/.csv (column username/external_id/email, else the first). */
  resolveFile: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post<T.ResolveResult>('/users/resolve-file', f);
  },
};

export const mediaApi = {
  upload: (file: Blob, name: string) => {
    const f = new FormData();
    f.append('file', file, name);
    return api.post<T.MediaFile>('/media', f);
  },
  /** Signed links for media ids found in content (unknown ids are left out). */
  links: (ids: string[]) => api.post<T.MediaRefs>('/media/links', { ids }),
};

export const groupApi = {
  list: (q: Q) => api.page<T.Group>('/groups', q),
  get: (id: string) => api.get<T.Group>(`/groups/${id}`),
  create: (body: { parent_id?: string | null; kind: T.GroupKind; code?: string; name: string; period?: string }) => api.post<T.Group>('/groups', body),
  update: (id: string, body: Partial<{ parent_id: string; kind: T.GroupKind; code: string; name: string; period: string }>) =>
    api.patch<T.Group>(`/groups/${id}`, body),
  remove: (id: string) => api.del(`/groups/${id}`),
  members: (id: string, q: Q) => api.page<T.GroupMember>(`/groups/${id}/members`, q),
  addMembers: (id: string, body: { user_ids?: string[]; from_group_id?: string; member_role?: 'member' | 'leader' }) =>
    api.post<T.AddMembersResult>(`/groups/${id}/members`, body),
  removeMember: (id: string, userId: string) => api.del(`/groups/${id}/members/${userId}`),
  removeMembers: (id: string, user_ids: string[]) => api.post<T.RemoveMembersResult>(`/groups/${id}/members/remove`, { user_ids }),
};

export const importApi = {
  template: (kind: T.ImportKind) => api.download(`/imports/templates/${kind}`, `template-impor-${kind}.xlsx`),
  list: (q: Q) => api.page<T.ImportJob>('/imports', q),
  get: (id: string) => api.get<T.ImportJob>(`/imports/${id}`),
  upload: (kind: T.ImportKind, file: File) => {
    const f = new FormData();
    f.append('kind', kind);
    f.append('file', file);
    return api.post<T.ImportJob>('/imports', f);
  },
  commit: (id: string) => api.post<T.ImportJob>(`/imports/${id}/commit`),
  credentials: (id: string) => api.download(`/imports/${id}/credentials`, 'akun-impor.xlsx'),
};

export const subjectApi = {
  list: (q: Q = {}) => api.page<T.Subject>('/subjects', { per_page: 100, ...q }),
  create: (body: { code: string; name: string }) => api.post<T.Subject>('/subjects', body),
  update: (id: string, body: Partial<{ code: string; name: string }>) => api.patch<T.Subject>(`/subjects/${id}`, body),
  remove: (id: string) => api.del(`/subjects/${id}`),
  competencies: (id: string) => api.get<T.Competency[]>(`/subjects/${id}/competencies`),
  createCompetency: (id: string, body: { code: string; name: string; parent_id?: string | null; sort_order?: number }) =>
    api.post<T.Competency>(`/subjects/${id}/competencies`, body),
  updateCompetency: (id: string, body: Partial<{ code: string; name: string; sort_order: number }>) => api.patch<T.Competency>(`/competencies/${id}`, body),
  removeCompetency: (id: string) => api.del(`/competencies/${id}`),
};

export const bankApi = {
  list: (q: Q) => api.page<T.Bank>('/item-banks', q),
  get: (id: string) => api.get<T.Bank>(`/item-banks/${id}`),
  create: (body: { subject_id: string; name: string; description?: string }) => api.post<T.Bank>('/item-banks', body),
  update: (id: string, body: Partial<{ name: string; description: string }>) => api.patch<T.Bank>(`/item-banks/${id}`, body),
  remove: (id: string) => api.del(`/item-banks/${id}`),
  members: (id: string) => api.get<T.BankMember[]>(`/item-banks/${id}/members`),
  setMember: (id: string, user_id: string, access: T.Access) => api.post(`/item-banks/${id}/members`, { user_id, access }),
  removeMember: (id: string, userId: string) => api.del(`/item-banks/${id}/members/${userId}`),
  stimuli: (id: string, q: Q) => api.page<T.Stimulus>(`/item-banks/${id}/stimuli`, q),
  createStimulus: (id: string, body: { title: string; body: string }) => api.post<T.Stimulus>(`/item-banks/${id}/stimuli`, body),
  updateStimulus: (id: string, body: Partial<{ title: string; body: string }>) => api.patch<T.Stimulus>(`/stimuli/${id}`, body),
  removeStimulus: (id: string) => api.del(`/stimuli/${id}`),
  items: (id: string, q: Q) => api.page<T.ItemSummary>(`/item-banks/${id}/items`, q),
  /** importWord reads a .docx: preview only, or create the valid items as drafts. */
  importWord: (id: string, file: File, preview: boolean) => {
    const f = new FormData();
    f.append('file', file);
    return api.post<T.WordImport>(`/item-banks/${id}/import-word${preview ? '?preview=1' : ''}`, f);
  },
  wordTemplate: () => api.download('/item-banks/import-word/template', 'template-impor-soal.docx'),
};

export interface ItemBody {
  code?: string;
  status?: T.ItemStatus;
  type: T.ItemType;
  content: T.ItemContent;
  answer_key: T.AnswerKey | null;
  scoring: T.Scoring;
  explanation?: string;
  default_points?: number;
  difficulty?: string;
  cognitive_level?: string;
  tags?: string[];
  competency_id?: string;
  stimulus_id?: string;
}

export const itemApi = {
  get: (id: string) => api.get<T.Item>(`/items/${id}`),
  create: (bankId: string, body: ItemBody) => api.post<T.Item>(`/item-banks/${bankId}/items`, body),
  update: (id: string, body: Partial<ItemBody>) => api.patch<T.Item>(`/items/${id}`, body),
  remove: (id: string) => api.del(`/items/${id}`),
  versions: (id: string) => api.get<T.VersionSummary[]>(`/items/${id}/versions`),
};

export const examApi = {
  list: (q: Q) => api.page<T.ExamSummary>('/exams', q),
  get: (id: string) => api.get<T.Exam>(`/exams/${id}`),
  create: (body: Record<string, unknown>) => api.post<T.Exam>('/exams', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<T.Exam>(`/exams/${id}`, body),
  remove: (id: string) => api.del(`/exams/${id}`),
  check: (id: string) => api.get<T.ExamCheck>(`/exams/${id}/check`),
  publish: (id: string) => api.post<T.Exam>(`/exams/${id}/publish`),
  unpublish: (id: string) => api.post<T.Exam>(`/exams/${id}/unpublish`),
  archive: (id: string) => api.post<T.Exam>(`/exams/${id}/archive`),
  createSection: (id: string, body: Record<string, unknown>) => api.post<T.Exam>(`/exams/${id}/sections`, body),
  orderSections: (id: string, ids: string[]) => api.post<T.Exam>(`/exams/${id}/sections/order`, { ids }),
  updateSection: (id: string, body: Record<string, unknown>) => api.patch<T.Exam>(`/sections/${id}`, body),
  removeSection: (id: string) => api.del<T.Exam>(`/sections/${id}`),
  addItems: (sectionId: string, items: { item_id: string; points?: number }[]) => api.post<T.Exam>(`/sections/${sectionId}/items`, { items }),
  orderItems: (sectionId: string, ids: string[]) => api.post<T.Exam>(`/sections/${sectionId}/items/order`, { ids }),
  updateSectionItem: (id: string, body: { points?: number | null; lock_options?: boolean }) => api.patch<T.Exam>(`/section-items/${id}`, body),
  removeSectionItem: (id: string) => api.del<T.Exam>(`/section-items/${id}`),
  createRule: (sectionId: string, body: Record<string, unknown>) => api.post<T.Exam>(`/sections/${sectionId}/rules`, body),
  updateRule: (id: string, body: Record<string, unknown>) => api.patch<T.Exam>(`/section-rules/${id}`, body),
  removeRule: (id: string) => api.del<T.Exam>(`/section-rules/${id}`),
};

export const sessionApi = {
  list: (q: Q) => api.page<T.SessionSummary>('/sessions', q),
  get: (id: string) => api.get<T.Session>(`/sessions/${id}`),
  print: (id: string) => api.get<T.SessionPrint>(`/sessions/${id}/print`),
  create: (body: Record<string, unknown>) => api.post<T.Session>('/sessions', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<T.Session>(`/sessions/${id}`, body),
  remove: (id: string) => api.del(`/sessions/${id}`),
  setStatus: (id: string, status: T.SessionStatus) => api.post<T.Session>(`/sessions/${id}/status`, { status }),
  token: (id: string) => api.get<T.SessionToken>(`/sessions/${id}/token`),
  rotateToken: (id: string) => api.post<T.SessionToken>(`/sessions/${id}/token/rotate`),
  setProctors: (id: string, user_ids: string[]) => api.put<T.Session>(`/sessions/${id}/proctors`, { user_ids }),
  participants: (id: string, q: Q) => api.page<T.Participant>(`/sessions/${id}/participants`, q),
  addParticipants: (id: string, body: { user_ids?: string[]; group_ids?: string[]; extra_time_minutes?: number }) =>
    api.post<{ added: number; skipped: number }>(`/sessions/${id}/participants`, body),
  updateParticipant: (id: string, userId: string, body: Partial<{ extra_time_minutes: number; attendance: T.Attendance; seat: string; notes: string }>) =>
    api.patch<T.Participant>(`/sessions/${id}/participants/${userId}`, body),
  removeParticipant: (id: string, userId: string) => api.del(`/sessions/${id}/participants/${userId}`),
  monitor: (id: string) => api.get<T.Monitor>(`/sessions/${id}/monitor`),
};

export const attemptApi = {
  extend: (id: string, minutes: number) => api.post(`/attempts/${id}/extend`, { minutes }),
  lock: (id: string) => api.post(`/attempts/${id}/lock`),
  unlock: (id: string) => api.post(`/attempts/${id}/unlock`),
  resetDevice: (id: string) => api.post(`/attempts/${id}/reset-device`),
  forceSubmit: (id: string) => api.post(`/attempts/${id}/force-submit`),
  /** Every audio clip with a play limit may be played `plays` more times. */
  grantPlays: (id: string, plays = 1) => api.post(`/attempts/${id}/grant-plays`, { plays }),
  report: (id: string) => api.get<T.AttemptReport>(`/attempts/${id}/report`),
};

export const gradingApi = {
  summary: (examId: string) => api.get<T.GradingSummaryRow[]>(`/exams/${examId}/grading/summary`),
  queue: (examId: string, q: Q) => api.page<T.GradingQueueRow>(`/exams/${examId}/grading`, q),
  item: (attemptItemId: string) => api.get<T.GradingItem>(`/grading/items/${attemptItemId}`),
  grade: (attemptItemId: string, body: { score?: number; rubric_scores?: { criterion: string; score: number }[]; comment?: string }) =>
    api.post<T.GradingItem>(`/grading/items/${attemptItemId}`, body),
  adjustments: (examId: string) => api.get<T.Adjustment[]>(`/exams/${examId}/adjustments`),
  createAdjustment: (examId: string, body: { item_version_id: string; action: T.AdjustmentAction; answer_key?: T.AnswerKey; reason: string }) =>
    api.post<T.Adjustment>(`/exams/${examId}/adjustments`, body),
  revokeAdjustment: (id: string) => api.del<T.Adjustment>(`/adjustments/${id}`),
};

export const reportApi = {
  recap: (examId: string, q: Q) => api.get<T.Recap>(`/exams/${examId}/recap`, q),
  exportRecap: (examId: string, q: Q) => api.download(`/exams/${examId}/recap/export`, 'rekap-nilai.xlsx', q),
  analysis: (examId: string, q: Q) => api.get<T.Analysis>(`/exams/${examId}/analysis`, q),
  recompute: (examId: string, q: Q) => api.post<T.Analysis>(`/exams/${examId}/analysis`, undefined, q),
};
