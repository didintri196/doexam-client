// DTO types mirroring apps/server/models/*_dto.go (JSON field names unchanged).
// Replace with types generated from OpenAPI once the server publishes it (09-FRONTEND §9 #1).

export type ID = string;
export type ISODate = string;

// ── auth & tenant ──────────────────────────────────────────────
export interface TenantSummary { id: ID; slug: string; name: string; preset: string }
export interface Me {
  id: ID;
  username: string;
  full_name: string;
  email: string | null;
  must_change_password: boolean;
  tenant: TenantSummary;
  roles: string[];
  permissions: string[];
}
export interface LoginResult { token: string; expires_at: ISODate; user: Me }
export interface PublicTenant {
  slug: string;
  name: string;
  tagline: string;
  preset: string;
  locale: string;
  primary_color: string | null;
  logo_url: string | null;
}
export interface TenantSettings {
  timezone: string;
  locale: string;
  primary_color: string | null;
  tagline: string;
  letterhead: string;
  exam_rules: string;
  logo_url: string | null;
  card: CardSettings;
}
/** Participant card settings (Pengaturan → Kartu peserta). signature_url is a signed, expiring link. */
export interface CardSettings {
  title: string;
  id_label: string;
  note: string;
  signer_title: string;
  signer_name: string;
  signer_number: string;
  signature_url: string | null;
  show_external_id: boolean;
  show_exam: boolean;
  show_session: boolean;
  show_seat: boolean;
  show_schedule: boolean;
  show_qr: boolean;
}
export type CardInput = Omit<CardSettings, 'signature_url'>;
export interface Tenant { id: ID; slug: string; name: string; preset: string; is_active: boolean; settings: TenantSettings }

// ── users & groups ─────────────────────────────────────────────
export type UserStatus = 'active' | 'suspended';
export interface Role { id: ID; code: string; name: string; permissions: string[]; is_system: boolean }
export interface User {
  id: ID;
  username: string;
  full_name: string;
  email: string | null;
  external_id: string | null;
  status: UserStatus;
  must_change_password: boolean;
  roles: string[];
  last_login_at: ISODate | null;
  created_at: ISODate;
}
export interface UserGroupRef { id: ID; name: string; kind: string; period: string | null; member_role: string }
export interface UserDetail extends User { groups: UserGroupRef[] }
export interface UserCreated { user: User; temporary_password?: string }
/** One user found by POST /users/resolve (e-mail is not echoed). */
export interface ResolvedUser {
  id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  status: UserStatus;
  input: string;
  matched_by: 'username' | 'external_id' | 'email';
}
export interface ResolveResult { found: ResolvedUser[]; not_found: string[]; ambiguous: string[] }

export type GroupKind = 'level' | 'class' | 'department' | 'team' | 'batch' | 'other';
export interface Group {
  id: ID;
  parent_id: ID | null;
  kind: GroupKind;
  code: string | null;
  name: string;
  period: string | null;
  member_count: number;
  created_at: ISODate;
}
export interface GroupMember {
  user_id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  member_role: 'member' | 'leader';
  joined_at: ISODate;
}
export interface AddMembersResult { requested: number; added: number }
export interface RemoveMembersResult { removed: number }

// ── imports ────────────────────────────────────────────────────
export type ImportKind = 'users' | 'groups';
export type ImportStatus = 'pending' | 'validating' | 'ready' | 'importing' | 'done' | 'failed';
export type ImportAudience = 'staff' | 'participant';
export interface ImportJob {
  id: ID;
  kind: ImportKind;
  /** '' = the original import (any role); group_id = participants into one group. */
  audience: ImportAudience | '';
  group_id: ID | null;
  summary: { created: number; added?: number; already_member?: number };
  status: ImportStatus;
  file_name: string;
  total_rows: number;
  ok_rows: number;
  error_rows: number;
  /** warning: true does not stop the import (ignored column, differing name, admin account). */
  errors: { row: number; field?: string; message: string; warning?: boolean }[];
  credentials_available: boolean;
  created_at: ISODate;
  finished_at: ISODate | null;
}

// ── subjects & item bank ───────────────────────────────────────
export interface Subject { id: ID; code: string; name: string; created_at: ISODate }
export interface Competency { id: ID; subject_id: ID; parent_id: ID | null; code: string; name: string; sort_order: number }
export type Access = 'viewer' | 'editor' | 'owner';
export interface Bank {
  id: ID;
  subject_id: ID;
  name: string;
  description: string | null;
  my_access: Access;
  item_count: number;
  created_at: ISODate;
}
export interface BankMember { user_id: ID; username: string; full_name: string; access: Access }
export interface Stimulus {
  id: ID;
  bank_id: ID;
  title: string;
  version_id: ID;
  version_no: number;
  body: string;
  locked: boolean;
  updated_at: ISODate;
}
export type ItemType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_answer' | 'essay';
export type ItemStatus = 'draft' | 'active' | 'retired';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface ItemOption { id: string; body: string }
export interface ItemContent { stem: string; options?: ItemOption[]; input?: 'text' | 'number'; max_words?: number | null }
export interface AcceptedAnswer { value: string; match?: 'exact' | 'case_insensitive' | 'numeric'; tolerance?: number | null }
export interface AnswerKey {
  correct?: string | string[];
  value?: boolean;
  accepted?: AcceptedAnswer[];
  model_answer?: string;
}
export interface RubricCriterion { criterion: string; max: number }
export interface Scoring { method?: 'all_or_nothing' | 'partial'; rubric?: RubricCriterion[] }
export interface ItemVersion {
  id: ID;
  version_no: number;
  type: ItemType;
  content: ItemContent;
  answer_key: AnswerKey | null;
  scoring: Scoring;
  explanation: string | null;
  default_points: number;
  difficulty: Difficulty | null;
  cognitive_level: string | null;
  tags: string[];
  competency_id: ID | null;
  stimulus: { id: ID; title: string; version_id: ID; version_no: number } | null;
  locked: boolean;
  created_at: ISODate;
}
export interface Item {
  id: ID;
  bank_id: ID;
  code: string | null;
  status: ItemStatus;
  version: ItemVersion;
  created_at: ISODate;
  updated_at: ISODate;
}
export interface ItemSummary {
  id: ID;
  code: string | null;
  status: ItemStatus;
  type: ItemType;
  version_no: number;
  stem_preview: string;
  difficulty: Difficulty | null;
  tags: string[];
  competency_id: ID | null;
  locked: boolean;
  updated_at: ISODate;
}
export interface VersionSummary { id: ID; version_no: number; type: ItemType; locked: boolean; current: boolean; created_at: ISODate }

// ── exams ──────────────────────────────────────────────────────
export type ExamStatus = 'draft' | 'published' | 'archived';
export type ExamMode = 'linear' | 'random_blueprint';
export type Navigation = 'free' | 'forward_only';
export type ResultVisibility = 'immediately' | 'after_grading' | 'after_session' | 'never';
export type AttemptScoring = 'highest' | 'latest' | 'average';
export interface ExamSummary {
  id: ID;
  title: string;
  subject_id: ID | null;
  mode: ExamMode;
  status: ExamStatus;
  duration_minutes: number | null;
  section_count: number;
  created_by: ID | null;
  published_at: ISODate | null;
  updated_at: ISODate;
}
export interface SectionItem {
  id: ID;
  item_id: ID;
  code: string | null;
  type: ItemType;
  item_status: ItemStatus;
  stem_preview: string;
  version_id: ID;
  version_no: number;
  pinned: boolean;
  points: number | null;
  effective_points: number;
  lock_options: boolean;
  sort_order: number;
}
export interface Rule {
  id: ID;
  bank_id: ID;
  competency_id: ID | null;
  item_type: ItemType | null;
  difficulty: Difficulty | null;
  tags_any: string[];
  item_count: number;
  points: number | null;
  available: number;
  sort_order: number;
}
export interface Section {
  id: ID;
  sort_order: number;
  title: string;
  instructions: string | null;
  duration_minutes: number | null;
  selection: 'fixed' | 'random';
  allow_revisit: boolean;
  passing_score: number | null;
  item_count: number;
  items: SectionItem[];
  rules: Rule[];
}
export interface Exam {
  id: ID;
  subject_id: ID | null;
  title: string;
  description: string | null;
  instructions: string | null;
  mode: ExamMode;
  status: ExamStatus;
  duration_minutes: number | null;
  navigation: Navigation;
  shuffle_items: boolean;
  shuffle_options: boolean;
  result_visibility: ResultVisibility;
  show_explanation: boolean;
  max_attempts: number;
  attempt_scoring: AttemptScoring;
  passing_score: number | null;
  negative_marking: number;
  security: { profile?: 'light' | 'standard' };
  settings: Record<string, unknown>;
  item_count: number;
  total_points: number | null;
  total_minutes: number | null;
  sections: Section[];
  can_edit: boolean;
  published_at: ISODate | null;
  created_by: ID | null;
  created_at: ISODate;
  updated_at: ISODate;
}
export interface ExamCheck { ready: boolean; problems: { section_id?: ID; rule_id?: ID; item_id?: ID; message: string }[] }

// ── sessions ───────────────────────────────────────────────────
export type SessionStatus = 'scheduled' | 'open' | 'paused' | 'closed' | 'cancelled';
export type Attendance = 'expected' | 'present' | 'absent' | 'excused';
export interface Person { user_id: ID; username: string; full_name: string }
export interface SessionSummary {
  id: ID;
  exam_id: ID;
  exam_title: string;
  name: string;
  room: string | null;
  starts_at: ISODate;
  ends_at: ISODate;
  status: SessionStatus;
  is_makeup: boolean;
  participant_count: number;
}
export interface Session {
  id: ID;
  exam: { id: ID; title: string; status: string; total_minutes: number | null };
  name: string;
  room: string | null;
  starts_at: ISODate;
  ends_at: ISODate;
  late_entry_minutes: number | null;
  token_required: boolean;
  token_rotation_minutes: number;
  status: SessionStatus;
  is_makeup: boolean;
  participant_count: number;
  attendance: Record<string, number>;
  proctors: Person[];
  groups: { id: ID; name: string; period: string | null }[];
  my_role: 'manager' | 'proctor';
  created_at: ISODate;
  updated_at: ISODate;
}
export interface SessionToken { code: string; expires_at: ISODate; rotation_minutes: number }
export interface Participant {
  user_id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  extra_time_minutes: number;
  attendance: Attendance;
  seat: string | null;
  notes: string | null;
  added_at: ISODate;
}
export interface MySession {
  session_id: ID;
  exam_id: ID;
  exam_title: string;
  name: string;
  room: string | null;
  starts_at: ISODate;
  ends_at: ISODate;
  status: SessionStatus;
  token_required: boolean;
  total_minutes: number | null;
  extra_time_minutes: number;
  seat: string | null;
}

// ── attempts ───────────────────────────────────────────────────
export type AttemptStatus = 'in_progress' | 'locked' | 'submitted' | 'graded' | 'void';
export type Response =
  | { selected: string }
  | { selected: string[] }
  | { value: boolean }
  | { text: string };
export interface ItemView {
  id: ID;
  position: number;
  type: ItemType;
  stem: string;
  options?: ItemOption[];
  input?: 'text' | 'number';
  max_words?: number;
  stimulus?: { id: ID; title: string; body: string };
  max_points: number;
  response: Response | null;
  flagged: boolean;
}
export interface SectionView {
  id: ID;
  title: string;
  instructions: string | null;
  sort_order: number;
  state: 'pending' | 'active' | 'closed';
  deadline_at: ISODate | null;
  allow_revisit: boolean;
  item_count: number;
  items: ItemView[] | null;
}
// ── media ──────────────────────────────────────────────────────
/** What a renderer needs for one data-media-id (signed URL, type, image size). */
export interface MediaRef { url: string; mime: string; w?: number; h?: number }
export type MediaRefs = Record<string, MediaRef>;
export interface MediaFile { id: ID; mime_type: string; size_bytes: number; width: number | null; height: number | null; url: string }

export interface AttemptView {
  id: ID;
  session_id: ID;
  exam_title: string;
  instructions: string | null;
  status: AttemptStatus;
  navigation: Navigation;
  section_mode: 'shared' | 'sequential';
  security_profile: 'light' | 'standard';
  settings: Record<string, unknown>;
  started_at: ISODate;
  deadline_at: ISODate;
  server_time: ISODate;
  sections: SectionView[];
  /** Signed links for every data-media-id in the delivered items. */
  media: MediaRefs;
  /** Plays recorded on the server per audio clip; extra_plays is granted by proctors. */
  media_plays: Record<string, number>;
  extra_plays: number;
}
export type EventType = 'RESPONSE_SAVED' | 'FLAG_SET' | 'ITEM_VIEWED' | 'FOCUS_LOST' | 'FOCUS_RETURNED' | 'FULLSCREEN_EXIT' | 'MEDIA_PLAYED' | 'ANNOUNCEMENT_READ';
export interface ClientEvent {
  client_event_id: string;
  client_seq: number;
  type: EventType;
  attempt_item_id?: string;
  payload: unknown;
  client_ts: ISODate;
}
export interface SyncResult {
  accepted: number;
  duplicates: number;
  rejected: { client_event_id: string; reason: string }[] | null;
  status: AttemptStatus;
  deadline_at: ISODate;
  server_time: ISODate;
  /** Changes when an announcement of the session is sent or retracted ("" = none). */
  announcement_cursor: string;
}

// ── announcements (DOCS/PLAN/12-PENGUMUMAN-PESERTA.md) ───────────
export type AnnouncementPriority = 'info' | 'important';
/** An announcement as its recipient sees it; a retracted one has an empty body. */
export interface MyAnnouncement {
  id: ID;
  session_id: ID;
  body: string;
  priority: AnnouncementPriority;
  from: 'proctor' | 'committee';
  read_at: ISODate | null;
  retracted_at: ISODate | null;
  created_at: ISODate;
}
export interface MyAnnouncements { cursor: string; announcements: MyAnnouncement[] }
export interface Announcement {
  id: ID;
  body: string;
  priority: AnnouncementPriority;
  target: 'all' | 'selected';
  sender: { user_id: ID; username: string; full_name: string };
  recipients: number;
  read: number;
  retracted_at: ISODate | null;
  created_at: ISODate;
}
export interface AnnouncementList { announcements: Announcement[]; unread_important: ID[] }
export interface AnnouncementRecipient { user_id: ID; username: string; full_name: string; seat: string | null; read_at: ISODate | null }
export interface AttemptResult {
  attempt_id: ID;
  status: AttemptStatus;
  visible: boolean;
  raw_score?: number;
  max_score?: number;
  final_score?: number;
  passed?: boolean;
  pending_manual: number;
  items?: { position: number; score: number | null; max_points: number; is_correct: boolean | null; explanation?: string }[];
  media?: MediaRefs;
}
export interface MyAttempt {
  id: ID;
  exam_id: ID;
  exam_title: string;
  session_id: ID;
  attempt_no: number;
  status: AttemptStatus;
  started_at: ISODate;
  deadline_at: ISODate;
  submitted_at: ISODate | null;
}
export interface MonitorRow {
  user_id: ID;
  username: string;
  full_name: string;
  seat: string | null;
  attendance: Attendance;
  attempt_id: ID | null;
  status: AttemptStatus | null;
  answered: number;
  item_count: number;
  deadline_at: ISODate | null;
  last_seen_at: ISODate | null;
  violations: number;
  device_bound: boolean;
  final_score: number | null;
  idle: boolean; // in progress without a sync for over 2 minutes
  violation_counts: Record<ViolationType, number>;
  last_violation_at: ISODate | null;
  locked_at: ISODate | null; // last LOCKED event
  submitted_at: ISODate | null;
}
export type ViolationType = 'focus_lost' | 'fullscreen_exit' | 'device_changed';
export type MonitorView = 'all' | 'violations' | 'idle' | 'locked' | 'not_started' | 'in_progress' | 'submitted';
export interface Monitor {
  session_id: ID;
  status: SessionStatus;
  server_time: ISODate;
  counts: Record<string, number>;
  rows: MonitorRow[];
}

// ── grading ────────────────────────────────────────────────────
export interface GradingSummaryRow {
  item_version_id: ID;
  item_id: ID;
  code: string | null;
  stem_preview: string;
  pending: number;
  graded: number;
}
export interface GradingQueueRow {
  attempt_item_id: ID;
  attempt_id: ID;
  item_version_id: ID;
  user_id?: ID;
  username?: string;
  full_name?: string;
  response: Response | null;
  max_points: number;
  score: number | null;
  score_source: string | null;
  answered_at: ISODate | null;
}
export interface GradingItem {
  attempt_item_id: ID;
  attempt_id: ID;
  item_version_id: ID;
  stem: string;
  model_answer: string | null;
  rubric: RubricCriterion[] | null;
  response: Response | null;
  max_points: number;
  score: number | null;
  score_source: string | null;
  history: { grader_id: ID; grader_name: string; score: number; rubric_scores: { criterion: string; score: number }[] | null; comment: string | null; created_at: ISODate }[];
  attempt_final_score: number | null;
  attempt_status: AttemptStatus;
}
export type AdjustmentAction = 'annul_full_credit' | 'annul_remove' | 'override_key';
export interface Adjustment {
  id: ID;
  item_version_id: ID;
  action: AdjustmentAction;
  answer_key: AnswerKey | null;
  reason: string;
  created_by: ID | null;
  created_at: ISODate;
  revoked_at: ISODate | null;
  regraded?: number;
}

// ── reports ────────────────────────────────────────────────────
export interface RecapRow {
  user_id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  session_name: string;
  attempts: number;
  status: string;
  score: number | null;
  passed: boolean | null;
  submitted_at: ISODate | null;
}
export interface Recap {
  exam_id: ID;
  exam_title: string;
  attempt_scoring: AttemptScoring;
  passing_score: number | null;
  counts: Record<string, number>;
  rows: RecapRow[];
}
export interface OptionStat { n: number; pct: number; pbis: number | null; is_key: boolean; flag?: 'non_functional' | 'attracts_high_scorers' }
export interface ItemStat {
  item_version_id: ID;
  item_id: ID;
  code: string | null;
  type: ItemType;
  stem_preview: string;
  n: number;
  omitted: number;
  p_value: number | null;
  discrimination: number | null;
  difficulty_level?: 'easy' | 'medium' | 'hard';
  discrimination_level?: 'excellent' | 'good' | 'fair' | 'poor';
  recommendation?: 'keep' | 'revise' | 'check_key';
  options?: Record<string, OptionStat>;
}
export interface Analysis {
  exam_id: ID;
  session_id: ID | null;
  computed_at: ISODate;
  warnings: string[];
  exam: {
    n_attempts: number;
    mean: number | null;
    sd: number | null;
    min: number | null;
    max: number | null;
    median: number | null;
    reliability: number | null;
    common_items: number;
    pass_rate: number | null;
    distribution: number[];
  };
  items: ItemStat[];
}
export interface AttemptReport {
  attempt_id: ID;
  exam_id: ID;
  exam_title: string;
  session_name: string;
  user_id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  attempt_no: number;
  status: string;
  submit_reason: string | null;
  started_at: ISODate;
  submitted_at: ISODate | null;
  duration_seconds: number | null;
  raw_score: number | null;
  max_score: number | null;
  final_score: number | null;
  passed: boolean | null;
  pending_manual: number;
  violations: Record<string, number>;
  sections: { title: string; raw_score: number | null; max_score: number | null; passed: boolean | null }[];
  competencies: { competency_id: ID; code: string; name: string; score: number; max_score: number; percent: number; items: number }[];
  items: {
    position: number;
    item_id: ID;
    code: string | null;
    type: ItemType;
    stem_preview: string;
    response: Response | null;
    answer_key: AnswerKey | null;
    score: number | null;
    max_points: number;
    is_correct: boolean | null;
    score_source: string | null;
    time_spent_ms: number;
    visits: number;
    flagged: boolean;
  }[];
}

// ── session documents (GET /sessions/:id/print) ────────────────
export interface PrintParticipant {
  user_id: ID;
  username: string;
  full_name: string;
  external_id: string | null;
  seat: string | null;
  attendance: Attendance;
  attempt_status: AttemptStatus | null;
}
export interface PrintStats { registered: number; present: number; absent: number; excused: number; started: number; submitted: number }
export interface SessionPrint {
  session: Session;
  institution: { name: string; letterhead: string; exam_rules: string; logo_url: string | null; card: CardSettings };
  participants: PrintParticipant[];
  stats: PrintStats;
  generated_at: ISODate;
}

// ── Word import (POST /item-banks/:id/import-word) ─────────────
export interface WordIssue { field?: string; message: string }
export interface WordItem {
  no: number;
  type: ItemType;
  stem: string;
  options?: { label: string; body: string; correct: boolean }[];
  key?: string;
  points?: number;
  competency?: string;
  stimulus?: string;
  explanation?: string;
  errors: WordIssue[];
  warnings: WordIssue[];
}
export interface WordImport {
  items: WordItem[];
  valid: number;
  invalid: number;
  stimuli: number;
  readings: { title: string; body: string }[];
  warnings: string[];
  media?: MediaRefs;
  created: number;
  created_stimuli: number;
  committed: boolean;
}
export interface CardPasswords { passwords: { user_id: ID; password: string }[]; skipped: number }
